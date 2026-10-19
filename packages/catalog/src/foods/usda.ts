import { normalizeText, type FoodGroup } from '@stenia/core';
import { food, type Db } from '@stenia/db';
import { sql } from 'drizzle-orm';

import { foodGroupFor } from './classify';
import { STAPLES } from './staples';
import { translateFoodName, translatePortion } from './translate';

/** USDA FoodData Central (SR Legacy + Foundation): dominio público (CC0). Se cita la fuente en Créditos. */
export const USDA_LICENSE = 'USDA FoodData Central · dominio público (CC0)';
export const usdaUrl = (fdcId: number | string) => `https://fdc.nal.usda.gov/food-details/${fdcId}/nutrients`;

type UsdaNutrient = { nutrient?: { id?: number }; amount?: number };
type UsdaPortion = {
  amount?: number;
  value?: number;
  modifier?: string;
  portionDescription?: string;
  measureUnit?: { name?: string; abbreviation?: string };
  gramWeight?: number;
};
export type UsdaFood = {
  fdcId: number;
  description: string;
  foodCategory?: { description?: string } | null;
  foodNutrients?: UsdaNutrient[];
  foodPortions?: UsdaPortion[];
};

/** [fdcId, nombre EN, nombre ES, grupo, kcal, proteína, carbohidratos, grasa, fibra, porciones, etiquetas, revisado] */
export type CompactFood = [number, string, string, FoodGroup, number, number, number, number, number | null, [string, number][], string[], 0 | 1];
export type CompactFoodsFile = { meta: { sources: string[]; generatedAt: string; license: string; count: number }; foods: CompactFood[] };

const EXCLUDED_CATEGORIES = new Set(['American Indian/Alaska Native Foods', 'Baby Foods']);
const r1 = (n: number) => Math.round(n * 10) / 10;

function nutrient(f: UsdaFood, ...ids: number[]): number | null {
  for (const id of ids) {
    const n = f.foodNutrients?.find((x) => x.nutrient?.id === id && typeof x.amount === 'number');
    if (n && typeof n.amount === 'number') return n.amount;
  }
  return null;
}

function portionLabel(p: UsdaPortion): string | null {
  const unit = p.measureUnit?.name && !['undetermined', 'RACC'].includes(p.measureUnit.name) ? p.measureUnit.name : '';
  if (p.measureUnit?.name === 'RACC') return null;
  const amount = p.amount ?? p.value ?? 1;
  const text = [unit, p.modifier ?? p.portionDescription ?? ''].filter(Boolean).join(' ').trim();
  if (!text || /quantity not specified/i.test(text)) return null;
  return `${Number.isInteger(amount) ? amount : r1(amount)} ${text}`;
}

/** Convierte los JSON de USDA en el archivo compacto versionado en el repo (scripts/build-foods.ts). */
export function buildCompactFoods(sources: { label: string; foods: (UsdaFood | null)[]; preferred: boolean }[], generatedAt = new Date().toISOString()): CompactFoodsFile {
  const staples = new Map(STAPLES.map((s) => [s.fdcId, s]));
  const byDescription = new Map<string, { food: UsdaFood; preferred: boolean }>();
  for (const source of sources) {
    for (const f of source.foods) {
      if (!f || (EXCLUDED_CATEGORIES.has(f.foodCategory?.description ?? '') && !staples.has(f.fdcId))) continue;
      const key = f.description.toLowerCase().trim();
      const current = byDescription.get(key);
      const isStaple = staples.has(f.fdcId);
      if (!current || isStaple || (source.preferred && !staples.has(current.food.fdcId) && !current.preferred)) {
        byDescription.set(key, { food: f, preferred: source.preferred });
      }
    }
  }
  const out: CompactFood[] = [];
  for (const { food: f } of byDescription.values()) {
    const protein = nutrient(f, 1003) ?? 0;
    const fat = nutrient(f, 1004, 1085) ?? 0;
    const carbs = nutrient(f, 1005, 1050) ?? 0;
    const kcal = nutrient(f, 1008, 2047, 2048) ?? (protein || fat || carbs ? protein * 4 + carbs * 4 + fat * 9 : null);
    if (kcal === null) continue;
    const staple = staples.get(f.fdcId);
    const category = f.foodCategory?.description ?? '';
    const group = staple?.group ?? foodGroupFor(category, f.description);
    const usdaPortions = (f.foodPortions ?? [])
      .map((p) => ({ label: portionLabel(p), grams: p.gramWeight ?? 0 }))
      .filter((p): p is { label: string; grams: number } => p.label !== null && p.grams > 0)
      .map((p) => [translatePortion(p.label), r1(p.grams)] as [string, number]);
    const portions = staple ? [...staple.portions, ...usdaPortions.slice(0, 2)] : usdaPortions;
    const unique = portions.filter((p, i) => portions.findIndex((q) => q[0] === p[0]) === i).slice(0, 5);
    out.push([
      f.fdcId,
      f.description,
      staple?.es ?? translateFoodName(f.description),
      group,
      Math.round(kcal),
      r1(protein),
      r1(carbs),
      r1(fat),
      nutrient(f, 1079) !== null ? r1(nutrient(f, 1079) as number) : null,
      unique,
      staple ? [...staple.tags, 'staple', `grams:${staple.grams}`] : [],
      staple ? 1 : 0,
    ]);
  }
  out.sort((a, b) => a[0] - b[0]);
  const missing = STAPLES.filter((s) => !out.some((f) => f[0] === s.fdcId));
  if (missing.length > 0) throw new Error(`Alimentos básicos sin datos en USDA: ${missing.map((m) => m.fdcId).join(', ')}`);
  return { meta: { sources: sources.map((s) => s.label), generatedAt, license: USDA_LICENSE, count: out.length }, foods: out };
}

export async function loadCompactFoods(): Promise<CompactFoodsFile> {
  const mod = (await import('../../data/usda-foods.json')) as unknown as { default: CompactFoodsFile };
  return mod.default;
}

/** Inserta o actualiza los alimentos USDA. Conserva nombres mejorados a mano o por IA salvo en los básicos. */
export async function importUsdaFoods(
  db: Db,
  options: { data?: CompactFoodsFile; onProgress?: (done: number, total: number) => void | Promise<void>; chunk?: number } = {},
): Promise<{ foods: number }> {
  const data = options.data ?? (await loadCompactFoods());
  const chunk = options.chunk ?? 400;
  const total = data.foods.length;
  for (let i = 0; i < total; i += chunk) {
    const rows = data.foods.slice(i, i + chunk).map(([fdcId, en, es, group, kcal, p, c, f, fiber, portions, tags, reviewed]) => ({
      source: 'usda' as const,
      sourceId: String(fdcId),
      nameEs: es,
      nameEn: en,
      kcal,
      proteinG: p,
      carbsG: c,
      fatG: f,
      fiberG: fiber,
      portions: portions.map(([label, grams]) => ({ label, grams })),
      groupCode: group,
      searchText: normalizeText(`${es} ${en}`),
      nameReviewed: reviewed === 1,
      tags,
      license: USDA_LICENSE,
      attributionUrl: usdaUrl(fdcId),
    }));
    await db
      .insert(food)
      .values(rows)
      .onConflictDoUpdate({
        target: [food.source, food.sourceId],
        set: {
          nameEn: sql`excluded.name_en`,
          nameEs: sql`CASE WHEN excluded.name_reviewed THEN excluded.name_es ELSE ${food.nameEs} END`,
          searchText: sql`CASE WHEN excluded.name_reviewed THEN excluded.search_text ELSE ${food.searchText} END`,
          nameReviewed: sql`${food.nameReviewed} OR excluded.name_reviewed`,
          kcal: sql`excluded.kcal`,
          proteinG: sql`excluded.protein_g`,
          carbsG: sql`excluded.carbs_g`,
          fatG: sql`excluded.fat_g`,
          fiberG: sql`excluded.fiber_g`,
          portions: sql`excluded.portions`,
          groupCode: sql`excluded.group_code`,
          tags: sql`excluded.tags`,
          license: sql`excluded.license`,
          attributionUrl: sql`excluded.attribution_url`,
        },
      });
    await options.onProgress?.(Math.min(total, i + chunk), total);
  }
  return { foods: total };
}
