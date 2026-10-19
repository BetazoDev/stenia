import 'server-only';

import { importUsdaFoods } from '@stenia/catalog';
import { FoodGroup, normalizeText, type Macros } from '@stenia/core';
import { food, foodFavorite, mealLog, savedMeal, type FoodPortion } from '@stenia/db';
import { and, count, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import { getDb } from './db';

export type FoodRow = typeof food.$inferSelect;
export type FoodView = {
  id: string;
  name: string;
  nameEn: string | null;
  brand: string | null;
  source: string;
  group: FoodGroup | null;
  per100: Macros;
  fiberG: number | null;
  portions: FoodPortion[];
  staple: boolean;
  tags: string[];
  defaultGrams: number;
  attributionUrl: string | null;
};

export function toFoodView(f: FoodRow): FoodView {
  const gramsTag = f.tags.find((t) => t.startsWith('grams:'));
  return {
    id: f.id,
    name: f.nameEs,
    nameEn: f.nameEn,
    brand: f.brand,
    source: f.source,
    group: (FoodGroup.safeParse(f.groupCode).success ? f.groupCode : null) as FoodGroup | null,
    per100: { kcal: f.kcal, proteinG: f.proteinG, carbsG: f.carbsG, fatG: f.fatG },
    fiberG: f.fiberG,
    portions: f.portions,
    staple: f.tags.includes('staple'),
    tags: f.tags,
    defaultGrams: gramsTag ? Number(gramsTag.slice(6)) : (f.portions[0]?.grams ?? 100),
    attributionUrl: f.attributionUrl,
  };
}

let importing: Promise<unknown> | null = null;

/** Carga los alimentos USDA la primera vez que se necesitan (como el catálogo de ejercicios). */
export async function ensureFoods(): Promise<void> {
  const [row] = await getDb().select({ n: count() }).from(food).where(eq(food.source, 'usda'));
  if ((row?.n ?? 0) > 0) return;
  importing ??= importUsdaFoods(getDb()).finally(() => {
    importing = null;
  });
  await importing;
}

const visibleTo = (userId: string) => or(isNull(food.userId), eq(food.userId, userId));

/** Búsqueda por todas las palabras (español o inglés); básicos y nombres revisados primero. */
export async function searchFoods(userId: string, q: string, limit = 30): Promise<FoodView[]> {
  await ensureFoods();
  const terms = normalizeText(q).split(' ').filter((t) => t.length > 1).slice(0, 6);
  if (terms.length === 0) return [];
  const rows = await getDb()
    .select()
    .from(food)
    .where(and(visibleTo(userId), ...terms.map((t) => sql`${food.searchText} like ${`%${t}%`}`)))
    .orderBy(
      sql`(${food.tags} @> '["staple"]'::jsonb) desc`,
      sql`(${food.userId} is not null) desc`,
      sql`${food.nameReviewed} desc`,
      sql`(position(${terms[0]} in ${food.searchText}) = 1) desc`,
      sql`length(${food.nameEs})`,
    )
    .limit(limit);
  return rows.map(toFoodView);
}

export async function foodsByIds(ids: string[]): Promise<Map<string, FoodView>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = await getDb().select().from(food).where(inArray(food.id, unique));
  return new Map(rows.map((r) => [r.id, toFoodView(r)]));
}

export async function stapleFoods(): Promise<FoodView[]> {
  await ensureFoods();
  const rows = await getDb().select().from(food).where(sql`${food.tags} @> '["staple"]'::jsonb`);
  return rows.map(toFoodView);
}

export async function listFavorites(userId: string): Promise<FoodView[]> {
  const rows = await getDb()
    .select({ f: food })
    .from(foodFavorite)
    .innerJoin(food, eq(food.id, foodFavorite.foodId))
    .where(eq(foodFavorite.userId, userId))
    .orderBy(desc(foodFavorite.createdAt));
  return rows.map((r) => toFoodView(r.f));
}

export async function toggleFavorite(userId: string, foodId: string): Promise<boolean> {
  const db = getDb();
  const [existing] = await db.select().from(foodFavorite).where(and(eq(foodFavorite.userId, userId), eq(foodFavorite.foodId, foodId)));
  if (existing) {
    await db.delete(foodFavorite).where(and(eq(foodFavorite.userId, userId), eq(foodFavorite.foodId, foodId)));
    return false;
  }
  await db.insert(foodFavorite).values({ userId, foodId }).onConflictDoNothing();
  return true;
}

export async function favoriteIds(userId: string): Promise<Set<string>> {
  const rows = await getDb().select({ id: foodFavorite.foodId }).from(foodFavorite).where(eq(foodFavorite.userId, userId));
  return new Set(rows.map((r) => r.id));
}

/** Alimentos registrados recientemente (últimos 30 días), sin repetir. */
export async function recentFoods(userId: string, limit = 20): Promise<(FoodView & { lastGrams: number })[]> {
  const rows = await getDb()
    .select({ f: food, grams: mealLog.grams, at: mealLog.createdAt })
    .from(mealLog)
    .innerJoin(food, eq(food.id, mealLog.foodId))
    .where(and(eq(mealLog.userId, userId), sql`${mealLog.createdAt} > now() - interval '30 days'`))
    .orderBy(desc(mealLog.createdAt))
    .limit(200);
  const seen = new Map<string, FoodView & { lastGrams: number }>();
  for (const r of rows) if (!seen.has(r.f.id)) seen.set(r.f.id, { ...toFoodView(r.f), lastGrams: r.grams });
  return [...seen.values()].slice(0, limit);
}

// ── Comidas guardadas ─────────────────────────────────────────────────────────────────────

export async function listSavedMeals(userId: string) {
  const rows = await getDb().select().from(savedMeal).where(eq(savedMeal.userId, userId)).orderBy(desc(savedMeal.createdAt));
  const foods = await foodsByIds(rows.flatMap((r) => r.items.map((i) => i.foodId)));
  return rows.map((r) => ({
    ...r,
    items: r.items.map((i) => ({ ...i, food: foods.get(i.foodId) ?? null })).filter((i) => i.food !== null),
  }));
}

export async function createSavedMeal(userId: string, name: string, items: { foodId: string; grams: number }[]) {
  const [row] = await getDb().insert(savedMeal).values({ userId, name, items }).returning();
  return row;
}

export async function deleteSavedMeal(userId: string, id: string) {
  await getDb().delete(savedMeal).where(and(eq(savedMeal.userId, userId), eq(savedMeal.id, id)));
}

// ── Alimentos propios ─────────────────────────────────────────────────────────────────────

export const CustomFoodInput = z.object({
  name: z.string().trim().min(2).max(80),
  brand: z.string().trim().max(60).nullable().default(null),
  kcal: z.number().min(0).max(900),
  proteinG: z.number().min(0).max(100),
  carbsG: z.number().min(0).max(100),
  fatG: z.number().min(0).max(100),
  group: FoodGroup.nullable().default(null),
  portionLabel: z.string().trim().max(40).nullable().default(null),
  portionGrams: z.number().min(1).max(2000).nullable().default(null),
});

export async function createCustomFood(userId: string, raw: unknown): Promise<FoodView> {
  const input = CustomFoodInput.parse(raw);
  const [row] = await getDb()
    .insert(food)
    .values({
      source: 'custom',
      sourceId: crypto.randomUUID(),
      nameEs: input.name,
      brand: input.brand,
      kcal: input.kcal,
      proteinG: input.proteinG,
      carbsG: input.carbsG,
      fatG: input.fatG,
      groupCode: input.group,
      portions: input.portionLabel && input.portionGrams ? [{ label: input.portionLabel, grams: input.portionGrams }] : [],
      searchText: normalizeText(`${input.name} ${input.brand ?? ''}`),
      nameReviewed: true,
      userId,
    })
    .returning();
  if (!row) throw new Error('No se pudo crear el alimento.');
  return toFoodView(row);
}

// ── Código de barras (Open Food Facts, ODbL) ─────────────────────────────────────────────

const OffProduct = z.object({
  code: z.string(),
  product_name: z.string().optional(),
  product_name_es: z.string().optional(),
  generic_name_es: z.string().optional(),
  brands: z.string().optional(),
  serving_size: z.string().optional(),
  serving_quantity: z.union([z.number(), z.string()]).optional(),
  categories_tags: z.array(z.string()).optional(),
  nutriments: z
    .object({
      'energy-kcal_100g': z.number().optional(),
      energy_100g: z.number().optional(),
      proteins_100g: z.number().optional(),
      carbohydrates_100g: z.number().optional(),
      fat_100g: z.number().optional(),
      fiber_100g: z.number().optional(),
    })
    .partial()
    .optional(),
});

function offGroup(tags: string[]): FoodGroup {
  const t = tags.join(' ');
  if (/yogurts|milks|dairy-drinks/.test(t)) return 'dairy';
  if (/cheeses|meats|fishes|eggs|poultry|hams/.test(t)) return 'protein';
  if (/breads|cereals|pastas|tortillas|rices|crackers/.test(t)) return 'cereal';
  if (/legumes|beans/.test(t)) return 'legume';
  if (/fruits|fruit-juices/.test(t)) return 'fruit';
  if (/vegetables/.test(t)) return 'vegetable';
  if (/nuts|oils|butters|fats|mayonnaises/.test(t)) return 'fat';
  if (/sodas|sweets|sweet-spreads|chocolates|biscuits|candies|sugars|desserts|sweetened-beverages/.test(t)) return 'sugar';
  if (/waters|teas|coffees/.test(t)) return 'free';
  return 'mixed';
}

export type BarcodeResult = { ok: true; food: FoodView } | { ok: false; reason: 'not_found' | 'incomplete' | 'error'; message: string };

export async function lookupBarcode(code: string): Promise<BarcodeResult> {
  const clean = code.replace(/\D/g, '');
  if (clean.length < 8 || clean.length > 14) return { ok: false, reason: 'not_found', message: 'Código inválido (8 a 14 dígitos).' };
  const db = getDb();
  const [cached] = await db.select().from(food).where(and(eq(food.barcode, clean), isNull(food.userId))).limit(1);
  if (cached) return { ok: true, food: toFoodView(cached) };
  let json: unknown;
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${clean}.json?fields=code,product_name,product_name_es,generic_name_es,brands,serving_size,serving_quantity,categories_tags,nutriments`,
      { headers: { 'user-agent': 'Stenia/0.1 (https://stenia.halonso.digital)' }, signal: AbortSignal.timeout(8000) },
    );
    if (res.status === 404) return { ok: false, reason: 'not_found', message: 'Producto no encontrado en Open Food Facts.' };
    if (!res.ok) return { ok: false, reason: 'error', message: `Open Food Facts respondió ${res.status}.` };
    json = await res.json();
  } catch {
    return { ok: false, reason: 'error', message: 'No se pudo consultar Open Food Facts.' };
  }
  const parsed = z.object({ status: z.number(), product: OffProduct.optional() }).safeParse(json);
  if (!parsed.success || parsed.data.status !== 1 || !parsed.data.product) return { ok: false, reason: 'not_found', message: 'Producto no encontrado en Open Food Facts.' };
  const p = parsed.data.product;
  const n = p.nutriments ?? {};
  const kcal = n['energy-kcal_100g'] ?? (n.energy_100g !== undefined ? n.energy_100g / 4.184 : undefined);
  if (kcal === undefined || n.proteins_100g === undefined || n.carbohydrates_100g === undefined || n.fat_100g === undefined) {
    return { ok: false, reason: 'incomplete', message: 'El producto existe pero no tiene la tabla nutrimental completa. Puedes crearlo a mano.' };
  }
  const name = (p.product_name_es || p.product_name || p.generic_name_es || `Producto ${clean}`).trim().slice(0, 120);
  const brand = p.brands?.split(',')[0]?.trim() || null;
  const servingGrams = typeof p.serving_quantity === 'string' ? Number(p.serving_quantity) : p.serving_quantity;
  const [row] = await db
    .insert(food)
    .values({
      source: 'off',
      sourceId: clean,
      barcode: clean,
      nameEs: name,
      nameEn: p.product_name ?? null,
      brand,
      kcal: Math.round(kcal),
      proteinG: Math.round(n.proteins_100g * 10) / 10,
      carbsG: Math.round(n.carbohydrates_100g * 10) / 10,
      fatG: Math.round(n.fat_100g * 10) / 10,
      fiberG: n.fiber_100g ?? null,
      portions: servingGrams && Number.isFinite(servingGrams) && servingGrams > 0 ? [{ label: p.serving_size ? `1 porción (${p.serving_size})` : '1 porción', grams: servingGrams }] : [],
      groupCode: offGroup(p.categories_tags ?? []),
      searchText: normalizeText(`${name} ${brand ?? ''} ${clean}`),
      license: 'ODbL · Open Food Facts',
      attributionUrl: `https://world.openfoodfacts.org/product/${clean}`,
    })
    .onConflictDoUpdate({ target: [food.source, food.sourceId], set: { kcal: sql`excluded.kcal` } })
    .returning();
  if (!row) return { ok: false, reason: 'error', message: 'No se pudo guardar el producto.' };
  return { ok: true, food: toFoodView(row) };
}
