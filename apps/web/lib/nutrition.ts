import 'server-only';

import { AliasMealPlan, mealPlanPrompt } from '@stenia/ai';
import {
  ActivityLevel,
  FOOD_GROUP_LABELS_ES,
  MEAL_NAMES_ES,
  adaptiveTdee,
  ageFromBirthDate,
  computeTargets,
  ema,
  fillWeek,
  macrosFor,
  nutritionBlockers,
  roundMacros,
  scaleDay,
  sumMacros,
  templateMealPlan,
  type Budget,
  type Goal,
  type HealthFlags,
  type Macros,
  type MealPlanDay,
  type PlannerFood,
  type Sex,
  type Targets,
} from '@stenia/core';
import { mealLog, mealPlan, nutritionTarget, profile } from '@stenia/db';
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { z } from 'zod';

import { runAi } from './ai';
import { latestBodyComposition, weightSeries } from './body';
import { acceptedKcalAdjustments } from './checkins';
import { getDb } from './db';
import { addDays, localDateString } from './dates';
import { foodsByIds, listFavorites, recentFoods, stapleFoods, type FoodView } from './foods';
import { getProfile, readAnswers } from './profile';
import { weekdayIndex } from './time';

// ── Configuración ─────────────────────────────────────────────────────────────────────────

export const NutritionSetup = z.object({
  healthFlags: z.object({
    pregnant: z.boolean(),
    lactating: z.boolean(),
    diabetes: z.boolean(),
    kidneyDisease: z.boolean(),
    eatingDisorderHistory: z.boolean(),
  }),
  activity: ActivityLevel,
  mealsPerDay: z.number().int().min(2).max(6),
  budget: z.enum(['low', 'medium', 'high']),
  cooks: z.boolean(),
  excludedFoods: z.string().max(400).default(''),
  view: z.enum(['grams', 'equivalents']),
  minKcal: z.number().int().min(1000).max(4000).nullable(),
  maxWeeklyLossPct: z.number().min(0.25).max(1).nullable(),
});
export type NutritionSetup = z.infer<typeof NutritionSetup>;

export type NutritionState =
  | { status: 'needs_profile'; missing: string[] }
  | { status: 'needs_setup' }
  | { status: 'blocked'; reasons: (keyof HealthFlags)[] }
  | {
      status: 'ready';
      prefs: { mealsPerDay: number; budget: Budget; cooks: boolean; excludedFoods: string[]; view: 'grams' | 'equivalents' };
      limits: { minKcal?: number; maxWeeklyLossPct?: number };
      basics: { sex: Sex; age: number; heightCm: number; weightKg: number; goal: Goal; activity: z.infer<typeof ActivityLevel> };
    };

export async function getNutritionState(userId: string): Promise<NutritionState> {
  const p = await getProfile(userId);
  const answers = readAnswers(p);
  const missing: string[] = [];
  if (!p?.sex) missing.push('sexo');
  if (!p?.birthDate) missing.push('fecha de nacimiento');
  if (!p?.heightCm) missing.push('estatura');
  if (!p?.weightKg) missing.push('peso');
  if (!p?.goal) missing.push('objetivo');
  if (missing.length > 0 || !p) return { status: 'needs_profile', missing };
  const prefs = p.nutritionPrefs;
  if (!prefs.mealsPerDay) return { status: 'needs_setup' };
  const reasons = nutritionBlockers(p.healthFlags);
  if (reasons.length > 0) return { status: 'blocked', reasons };
  return {
    status: 'ready',
    prefs: {
      mealsPerDay: prefs.mealsPerDay,
      budget: prefs.budget ?? 'medium',
      cooks: prefs.cooks ?? true,
      excludedFoods: prefs.excludedFoods ?? [],
      view: prefs.view ?? 'grams',
    },
    limits: { ...(p.nutritionLimits.minKcal ? { minKcal: p.nutritionLimits.minKcal } : {}), ...(p.nutritionLimits.maxWeeklyLossPct ? { maxWeeklyLossPct: p.nutritionLimits.maxWeeklyLossPct } : {}) },
    basics: {
      sex: p.sex as Sex,
      age: ageFromBirthDate(p.birthDate as string),
      heightCm: p.heightCm as number,
      weightKg: p.weightKg as number,
      goal: p.goal as Goal,
      activity: (p.activity ?? answers.recovery?.activity ?? 'moderate') as z.infer<typeof ActivityLevel>,
    },
  };
}

export async function saveNutritionSetup(userId: string, raw: unknown) {
  const input = NutritionSetup.parse(raw);
  await getDb()
    .update(profile)
    .set({
      healthFlags: input.healthFlags,
      activity: input.activity,
      nutritionPrefs: {
        mealsPerDay: input.mealsPerDay,
        budget: input.budget,
        cooks: input.cooks,
        excludedFoods: input.excludedFoods
          .split(/[,\n]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 30),
        view: input.view,
      },
      nutritionLimits: {
        ...(input.minKcal ? { minKcal: input.minKcal } : {}),
        ...(input.maxWeeklyLossPct ? { maxWeeklyLossPct: input.maxWeeklyLossPct } : {}),
      },
      updatedAt: new Date(),
    })
    .where(eq(profile.userId, userId));
  return nutritionBlockers(input.healthFlags);
}

export async function setNutritionView(userId: string, view: 'grams' | 'equivalents') {
  const p = await getProfile(userId);
  if (!p) return;
  await getDb()
    .update(profile)
    .set({ nutritionPrefs: { ...p.nutritionPrefs, view }, updatedAt: new Date() })
    .where(eq(profile.userId, userId));
}

// ── Metas ─────────────────────────────────────────────────────────────────────────────────

/** kcal registradas por día (para el gasto adaptativo). */
export async function dailyIntake(userId: string, since: string) {
  const rows = await getDb()
    .select({ date: mealLog.date, grams: mealLog.grams, foodId: mealLog.foodId })
    .from(mealLog)
    .where(and(eq(mealLog.userId, userId), gte(mealLog.date, since)));
  const foods = await foodsByIds(rows.map((r) => r.foodId));
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const f = foods.get(r.foodId);
    if (!f) continue;
    byDay.set(r.date, (byDay.get(r.date) ?? 0) + (f.per100.kcal * r.grams) / 100);
  }
  return [...byDay.entries()].map(([date, kcal]) => ({ date, kcal: Math.round(kcal) })).sort((a, b) => a.date.localeCompare(b.date));
}

export type TargetsResult = (Targets & { adaptive: { tdee: number; days: number; avgIntake: number; changeKgPerWeek: number } | null; kcalAdjustment: number }) | null;

export async function computeUserTargets(userId: string): Promise<TargetsResult> {
  const state = await getNutritionState(userId);
  if (state.status !== 'ready') return null;
  const [body, weights, intake] = await Promise.all([latestBodyComposition(userId), weightSeries(userId), dailyIntake(userId, addDays(localDateString(), -28))]);
  const trend = ema(weights.raw);
  const adaptive = adaptiveTdee(intake, trend);
  const since = new Date(Date.now() - (adaptive ? 14 : 84) * 86_400_000);
  const kcalAdjustment = await acceptedKcalAdjustments(userId, since);
  const targets = computeTargets({
    ...state.basics,
    weightKg: body.weightKg ?? state.basics.weightKg,
    bodyFatPct: body.bodyFatPct,
    leanMassKg: body.leanMassKg,
    bmrMeasured: body.bmrMeasured,
    adaptiveTdee: adaptive?.tdee ?? null,
    limits: state.limits,
    kcalAdjustment,
  });
  return { ...targets, adaptive, kcalAdjustment };
}

export async function getCurrentTarget(userId: string) {
  const [row] = await getDb()
    .select()
    .from(nutritionTarget)
    .where(and(eq(nutritionTarget.userId, userId), lte(nutritionTarget.effectiveFrom, localDateString())))
    .orderBy(desc(nutritionTarget.effectiveFrom), desc(nutritionTarget.createdAt))
    .limit(1);
  return row ?? null;
}

/** Recalcula y guarda una meta nueva solo si cambió (historial en `nutrition_target`). */
export async function refreshTargets(userId: string) {
  const computed = await computeUserTargets(userId);
  if (!computed) return null;
  const current = await getCurrentTarget(userId);
  if (
    current &&
    current.kcal === computed.kcal &&
    current.proteinG === computed.proteinG &&
    current.carbsG === computed.carbsG &&
    current.fatG === computed.fatG &&
    current.method === computed.method
  ) {
    return current;
  }
  const [row] = await getDb()
    .insert(nutritionTarget)
    .values({
      userId,
      effectiveFrom: localDateString(),
      kcal: computed.kcal,
      proteinG: computed.proteinG,
      carbsG: computed.carbsG,
      fatG: computed.fatG,
      method: computed.method,
      rationale: computed.rationale.join(' '),
    })
    .returning();
  return row ?? null;
}

export async function targetHistory(userId: string) {
  return getDb().select().from(nutritionTarget).where(eq(nutritionTarget.userId, userId)).orderBy(desc(nutritionTarget.createdAt)).limit(20);
}

// ── Registro diario ───────────────────────────────────────────────────────────────────────

export type LogEntry = { id: string; meal: string; grams: number; food: FoodView; macros: Macros };

export async function dayLog(userId: string, date: string) {
  const rows = await getDb()
    .select()
    .from(mealLog)
    .where(and(eq(mealLog.userId, userId), eq(mealLog.date, date)))
    .orderBy(asc(mealLog.createdAt));
  const foods = await foodsByIds(rows.map((r) => r.foodId));
  const entries: LogEntry[] = rows
    .map((r) => {
      const f = foods.get(r.foodId);
      return f ? { id: r.id, meal: r.meal, grams: r.grams, food: f, macros: macrosFor(f.per100, r.grams) } : null;
    })
    .filter((e): e is LogEntry => e !== null);
  return { entries, totals: roundMacros(sumMacros(entries.map((e) => e.macros))) };
}

export const LogInput = z.object({
  date: z.iso.date(),
  meal: z.string().trim().min(1).max(40),
  foodId: z.string().min(1),
  grams: z.number().min(1).max(3000),
});

export async function addLogEntry(userId: string, raw: unknown) {
  const input = LogInput.parse(raw);
  const foods = await foodsByIds([input.foodId]);
  if (!foods.has(input.foodId)) throw new Error('Alimento no encontrado.');
  const [row] = await getDb()
    .insert(mealLog)
    .values({ userId, date: input.date, meal: input.meal, foodId: input.foodId, grams: Math.round(input.grams * 10) / 10 })
    .returning();
  return row;
}

export async function addLogEntries(userId: string, date: string, meal: string, items: { foodId: string; grams: number }[]) {
  if (items.length === 0) return;
  await getDb()
    .insert(mealLog)
    .values(items.map((i) => ({ userId, date, meal, foodId: i.foodId, grams: Math.round(i.grams * 10) / 10 })));
}

export async function updateLogGrams(userId: string, id: string, grams: number) {
  await getDb()
    .update(mealLog)
    .set({ grams: Math.max(1, Math.min(3000, Math.round(grams * 10) / 10)) })
    .where(and(eq(mealLog.userId, userId), eq(mealLog.id, id)));
}

export async function deleteLogEntry(userId: string, id: string) {
  await getDb().delete(mealLog).where(and(eq(mealLog.userId, userId), eq(mealLog.id, id)));
}

/** Días registrados en las últimas semanas (para la racha y la puerta de la fase). */
export async function loggedDays(userId: string, days = 28) {
  const rows = await getDb()
    .select({ date: mealLog.date, n: sql<number>`count(*)::int` })
    .from(mealLog)
    .where(and(eq(mealLog.userId, userId), gte(mealLog.date, addDays(localDateString(), -days))))
    .groupBy(mealLog.date);
  return rows.map((r) => r.date).sort();
}

export function mealNamesFor(mealsPerDay: number): string[] {
  return MEAL_NAMES_ES[Math.min(6, Math.max(2, mealsPerDay))] ?? ['Desayuno', 'Comida', 'Cena'];
}

// ── Plan semanal ──────────────────────────────────────────────────────────────────────────

export type StoredMealPlan = {
  days: MealPlanDay[];
  notes: string;
  generator: 'llm' | 'template';
  modelId: string | null;
  targets: { kcal: number; proteinG: number; carbsG: number; fatG: number };
  dayTotals: Macros[];
  ok: boolean;
};

function plannerFood(f: FoodView): PlannerFood {
  return { id: f.id, name: f.name, per100: f.per100, group: f.group, tags: f.tags, defaultGrams: f.defaultGrams };
}

function weekStartOf(date: string): string {
  const idx = weekdayIndex(new Date(`${date}T12:00:00Z`));
  return addDays(date, -idx);
}

export async function getActivePlan(userId: string) {
  const [row] = await getDb()
    .select()
    .from(mealPlan)
    .where(and(eq(mealPlan.userId, userId), eq(mealPlan.status, 'active')))
    .orderBy(desc(mealPlan.createdAt))
    .limit(1);
  if (!row) return null;
  const plan = row.plan as unknown as StoredMealPlan;
  const foods = await foodsByIds(plan.days.flatMap((d) => d.meals.flatMap((m) => m.items.map((i) => i.foodId))));
  return { ...row, data: plan, foods };
}

/** Día del plan que corresponde a una fecha (el plan empieza el lunes de su semana y se repite). */
export function planDayIndex(weekStart: string, date: string): number {
  const diff = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${weekStart}T12:00:00Z`)) / 86_400_000);
  return ((diff % 7) + 7) % 7;
}

function excludedMatch(f: FoodView, excluded: string[]): boolean {
  const name = `${f.name} ${f.nameEn ?? ''}`.toLowerCase();
  return excluded.some((e) => e.length > 2 && name.includes(e.toLowerCase()));
}

export type PlanEvent = { stage: 'targets' | 'foods' | 'choosing' | 'scaling' | 'fallback' | 'saving' | 'done' | 'error'; message: string };

export async function generateMealPlan(userId: string, emit: (e: PlanEvent) => void = () => undefined) {
  const state = await getNutritionState(userId);
  if (state.status === 'blocked') throw new Error('Por tus condiciones de salud no generamos planes: consulta a un nutriólogo o médico.');
  if (state.status !== 'ready') throw new Error('Completa tu configuración de nutrición primero.');
  emit({ stage: 'targets', message: 'Calculando tus metas' });
  const target = await refreshTargets(userId);
  if (!target) throw new Error('No se pudieron calcular tus metas.');
  const targets = { kcal: target.kcal, proteinG: target.proteinG, carbsG: target.carbsG, fatG: target.fatG };

  emit({ stage: 'foods', message: 'Reuniendo alimentos' });
  const [staples, favorites, recents] = await Promise.all([stapleFoods(), listFavorites(userId), recentFoods(userId, 15)]);
  const excluded = state.prefs.excludedFoods;
  const candidates = [...new Map([...staples, ...favorites, ...recents].filter((f) => !excludedMatch(f, excluded) && f.group !== 'free' && f.group !== 'mixed').map((f) => [f.id, f])).values()];
  const byId = new Map(candidates.map((f) => [f.id, f]));

  let days: MealPlanDay[] | null = null;
  let generator: 'llm' | 'template' = 'template';
  let modelId: string | null = null;
  let notes = '';

  emit({ stage: 'choosing', message: 'Armando el menú' });
  const codeToId = new Map<string, string>();
  const lines = candidates.map((f, i) => {
    const code = `F${i + 1}`;
    codeToId.set(code, f.id);
    return `${code} | ${f.name} | ${f.group ? FOOD_GROUP_LABELS_ES[f.group] : 'otro'} | ${f.per100.kcal} kcal, ${f.per100.proteinG} P, ${f.per100.carbsG} C, ${f.per100.fatG} G por 100 g`;
  });
  const rendered = mealPlanPrompt.render({
    targets,
    mealsPerDay: state.prefs.mealsPerDay,
    days: 4,
    budget: { low: 'bajo', medium: 'medio', high: 'holgado' }[state.prefs.budget],
    cooks: state.prefs.cooks,
    excluded: excluded.join(', '),
    foodLines: lines,
  });
  const result = await runAi({ fn: 'meal_plan', userId, schema: AliasMealPlan, system: rendered.system, prompt: rendered.prompt, promptId: mealPlanPrompt.id, promptVersion: mealPlanPrompt.version });
  if (result.ok) {
    const mapped: MealPlanDay[] = result.output.days.map((d) => ({
      meals: d.meals.map((m) => ({
        name: m.name.slice(0, 40),
        items: m.items.map((i) => ({ foodId: codeToId.get(i.foodId) ?? '', grams: i.grams })).filter((i) => byId.has(i.foodId)),
      })).filter((m) => m.items.length > 0),
    })).filter((d) => d.meals.length >= 2);
    if (mapped.length > 0) {
      days = mapped;
      generator = 'llm';
      modelId = result.modelId;
      notes = result.output.notes;
    }
  }
  if (!days) {
    emit({ stage: 'fallback', message: 'Usando el plan por plantillas' });
    const plannerFoods = staples.filter((f) => !excludedMatch(f, excluded)).map(plannerFood);
    days = templateMealPlan({ foods: plannerFoods, mealsPerDay: state.prefs.mealsPerDay, days: 7, budget: state.prefs.budget, cooks: state.prefs.cooks, target: targets }).days;
  }

  emit({ stage: 'scaling', message: 'Ajustando porciones a tus metas' });
  const allFoods = await foodsByIds(days.flatMap((d) => d.meals.flatMap((m) => m.items.map((i) => i.foodId))));
  const dayTotals: Macros[] = [];
  let ok = true;
  const scaledDays = days.map((d) => {
    const flat = d.meals.flatMap((m, mi) => m.items.map((it, ii) => ({ ...it, mi, ii, per100: allFoods.get(it.foodId)?.per100 as Macros, group: allFoods.get(it.foodId)?.group ?? null })));
    const scaled = scaleDay(flat, targets);
    ok &&= scaled.ok;
    dayTotals.push(roundMacros(scaled.totals));
    const meals = d.meals.map((m) => ({ ...m, items: m.items.map((i) => ({ ...i })) }));
    for (const s of scaled.items) {
      const t = meals[s.mi]?.items[s.ii];
      if (t) t.grams = s.grams;
    }
    return { meals };
  });
  const week = fillWeek(scaledDays, 7);
  const weekTotals = Array.from({ length: 7 }, (_, i) => dayTotals[i % dayTotals.length] as Macros);

  emit({ stage: 'saving', message: 'Guardando el plan' });
  const db = getDb();
  const stored: StoredMealPlan = { days: week, notes, generator, modelId, targets, dayTotals: weekTotals, ok };
  const [last] = await db.select({ version: mealPlan.version }).from(mealPlan).where(eq(mealPlan.userId, userId)).orderBy(desc(mealPlan.version)).limit(1);
  await db.update(mealPlan).set({ status: 'archived' }).where(and(eq(mealPlan.userId, userId), eq(mealPlan.status, 'active')));
  const [row] = await db
    .insert(mealPlan)
    .values({ userId, weekStart: weekStartOf(localDateString()), plan: stored as unknown as Record<string, unknown>, version: (last?.version ?? 0) + 1, targetId: target.id })
    .returning();
  emit({ stage: 'done', message: generator === 'llm' ? 'Plan listo' : 'Plan listo (plantilla)' });
  return row;
}

/** Cambia un alimento del plan por un sustituto y recalcula los totales del día. */
export async function substitutePlanItem(userId: string, input: { day: number; meal: number; item: number; foodId: string; grams: number }) {
  const active = await getActivePlan(userId);
  if (!active) throw new Error('No hay plan activo.');
  const plan = structuredClone(active.data);
  const target = plan.days[input.day]?.meals[input.meal]?.items[input.item];
  if (!target) throw new Error('Elemento del plan no encontrado.');
  target.foodId = input.foodId;
  target.grams = Math.max(5, Math.min(800, Math.round(input.grams)));
  const foods = await foodsByIds(plan.days.flatMap((d) => d.meals.flatMap((m) => m.items.map((i) => i.foodId))));
  plan.dayTotals = plan.days.map((d) => roundMacros(sumMacros(d.meals.flatMap((m) => m.items.map((i) => macrosFor(foods.get(i.foodId)?.per100 ?? { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }, i.grams))))));
  await getDb()
    .update(mealPlan)
    .set({ plan: plan as unknown as Record<string, unknown> })
    .where(and(eq(mealPlan.userId, userId), eq(mealPlan.id, active.id)));
}
