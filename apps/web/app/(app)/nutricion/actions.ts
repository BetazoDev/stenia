'use server';

import { substitutesFor } from '@stenia/core';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import {
  createCustomFood,
  createSavedMeal,
  deleteSavedMeal,
  favoriteIds,
  foodsByIds,
  listFavorites,
  listSavedMeals,
  lookupBarcode,
  recentFoods,
  searchFoods,
  stapleFoods,
  toggleFavorite,
  type BarcodeResult,
  type FoodView,
} from '@/lib/foods';
import {
  addLogEntries,
  addLogEntry,
  dayLog,
  deleteLogEntry,
  getActivePlan,
  planDayIndex,
  refreshTargets,
  saveNutritionSetup,
  setNutritionView,
  substitutePlanItem,
  updateLogGrams,
} from '@/lib/nutrition';
import { requireSession } from '@/lib/session';

export type ActionResult = { ok: true; message?: string } | { ok: false; message: string };

const fail = (error: unknown, fallback: string): ActionResult => ({
  ok: false,
  message: error instanceof z.ZodError ? 'Revisa los datos capturados.' : error instanceof Error ? error.message : fallback,
});

function revalidate() {
  revalidatePath('/nutricion');
  revalidatePath('/nutricion/plan');
  revalidatePath('/nutricion/metas');
  revalidatePath('/nutricion/compras');
}

export async function saveSetupAction(raw: unknown): Promise<ActionResult & { blocked?: boolean }> {
  const { user } = await requireSession();
  try {
    const blockers = await saveNutritionSetup(user.id, raw);
    if (blockers.length === 0) await refreshTargets(user.id);
    revalidate();
    return { ok: true, blocked: blockers.length > 0 };
  } catch (error) {
    return fail(error, 'No se pudo guardar la configuración.');
  }
}

export async function refreshTargetsAction(): Promise<ActionResult> {
  const { user } = await requireSession();
  await refreshTargets(user.id);
  revalidate();
  return { ok: true };
}

export async function setViewAction(view: 'grams' | 'equivalents') {
  const { user } = await requireSession();
  await setNutritionView(user.id, z.enum(['grams', 'equivalents']).parse(view));
  revalidatePath('/nutricion/plan');
}

export type PickerItem = FoodView & { favorite: boolean; lastGrams?: number };

export async function searchFoodsAction(q: string): Promise<PickerItem[]> {
  const { user } = await requireSession();
  const [results, favs] = await Promise.all([searchFoods(user.id, z.string().max(80).parse(q)), favoriteIds(user.id)]);
  return results.map((f) => ({ ...f, favorite: favs.has(f.id) }));
}

export async function pickerDataAction() {
  const { user } = await requireSession();
  const [favorites, recents, saved] = await Promise.all([listFavorites(user.id), recentFoods(user.id), listSavedMeals(user.id)]);
  const favs = new Set(favorites.map((f) => f.id));
  return {
    favorites: favorites.map((f) => ({ ...f, favorite: true })),
    recents: recents.map((f) => ({ ...f, favorite: favs.has(f.id) })),
    saved: saved.map((s) => ({ id: s.id, name: s.name, items: s.items.map((i) => ({ foodId: i.foodId, grams: i.grams, name: i.food?.name ?? '' })) })),
  };
}

export async function toggleFavoriteAction(foodId: string): Promise<boolean> {
  const { user } = await requireSession();
  return toggleFavorite(user.id, z.string().min(1).parse(foodId));
}

export async function addLogAction(raw: unknown): Promise<ActionResult> {
  const { user } = await requireSession();
  try {
    await addLogEntry(user.id, raw);
    revalidatePath('/nutricion');
    return { ok: true };
  } catch (error) {
    return fail(error, 'No se pudo registrar.');
  }
}

export async function updateLogAction(id: string, grams: number): Promise<ActionResult> {
  const { user } = await requireSession();
  await updateLogGrams(user.id, z.string().min(1).parse(id), z.number().min(1).max(3000).parse(grams));
  revalidatePath('/nutricion');
  return { ok: true };
}

export async function deleteLogAction(id: string): Promise<ActionResult> {
  const { user } = await requireSession();
  await deleteLogEntry(user.id, z.string().min(1).parse(id));
  revalidatePath('/nutricion');
  return { ok: true };
}

const DateSchema = z.iso.date();

/** Registra con un toque la comida del plan correspondiente a esa fecha. */
export async function logPlanMealAction(date: string, mealIndex: number): Promise<ActionResult> {
  const { user } = await requireSession();
  const plan = await getActivePlan(user.id);
  if (!plan) return { ok: false, message: 'No tienes un plan activo.' };
  const day = plan.data.days[planDayIndex(plan.weekStart, DateSchema.parse(date))];
  const meal = day?.meals[z.number().int().min(0).max(9).parse(mealIndex)];
  if (!meal) return { ok: false, message: 'Esa comida no está en el plan.' };
  await addLogEntries(user.id, date, meal.name, meal.items);
  revalidatePath('/nutricion');
  return { ok: true };
}

export async function logSavedMealAction(date: string, meal: string, savedMealId: string): Promise<ActionResult> {
  const { user } = await requireSession();
  const saved = (await listSavedMeals(user.id)).find((s) => s.id === savedMealId);
  if (!saved) return { ok: false, message: 'Comida guardada no encontrada.' };
  await addLogEntries(user.id, DateSchema.parse(date), z.string().min(1).max(40).parse(meal), saved.items.map((i) => ({ foodId: i.foodId, grams: i.grams })));
  revalidatePath('/nutricion');
  return { ok: true };
}

export async function saveMealAction(date: string, meal: string, name: string): Promise<ActionResult> {
  const { user } = await requireSession();
  const log = await dayLog(user.id, DateSchema.parse(date));
  const items = log.entries.filter((e) => e.meal === meal).map((e) => ({ foodId: e.food.id, grams: e.grams }));
  if (items.length === 0) return { ok: false, message: 'Esa comida está vacía.' };
  await createSavedMeal(user.id, z.string().trim().min(1).max(60).parse(name), items);
  return { ok: true, message: 'Comida guardada.' };
}

export async function deleteSavedMealAction(id: string): Promise<ActionResult> {
  const { user } = await requireSession();
  await deleteSavedMeal(user.id, z.string().min(1).parse(id));
  return { ok: true };
}

export async function barcodeAction(code: string): Promise<BarcodeResult> {
  await requireSession();
  return lookupBarcode(z.string().max(20).parse(code));
}

export async function createCustomFoodAction(raw: unknown): Promise<{ ok: true; food: PickerItem } | { ok: false; message: string }> {
  const { user } = await requireSession();
  try {
    const f = await createCustomFood(user.id, raw);
    return { ok: true, food: { ...f, favorite: false } };
  } catch (error) {
    const r = fail(error, 'No se pudo crear el alimento.');
    return { ok: false, message: r.ok ? '' : r.message };
  }
}

const ItemRef = z.object({ day: z.number().int().min(0).max(6), meal: z.number().int().min(0).max(9), item: z.number().int().min(0).max(9) });

export async function substitutesAction(raw: unknown): Promise<{ id: string; name: string; grams: number; kcal: number; proteinG: number }[]> {
  const { user } = await requireSession();
  const ref = ItemRef.parse(raw);
  const plan = await getActivePlan(user.id);
  const item = plan?.data.days[ref.day]?.meals[ref.meal]?.items[ref.item];
  const current = item ? plan?.foods.get(item.foodId) : undefined;
  if (!item || !current) return [];
  const [staples, favorites] = await Promise.all([stapleFoods(), listFavorites(user.id)]);
  const pool = [...new Map([...staples, ...favorites].map((f) => [f.id, f])).values()];
  return substitutesFor({ id: current.id, grams: item.grams, per100: current.per100, group: current.group }, pool, 8).map((s) => ({
    id: s.id,
    name: s.name,
    grams: s.grams,
    kcal: Math.round((s.per100.kcal * s.grams) / 100),
    proteinG: Math.round((s.per100.proteinG * s.grams) / 100),
  }));
}

export async function substituteAction(raw: unknown): Promise<ActionResult> {
  const { user } = await requireSession();
  try {
    const input = ItemRef.extend({ foodId: z.string().min(1), grams: z.number().min(5).max(800) }).parse(raw);
    const exists = await foodsByIds([input.foodId]);
    if (!exists.has(input.foodId)) return { ok: false, message: 'Alimento no encontrado.' };
    await substitutePlanItem(user.id, input);
    revalidate();
    return { ok: true };
  } catch (error) {
    return fail(error, 'No se pudo sustituir.');
  }
}
