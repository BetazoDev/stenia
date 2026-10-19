import type { FoodGroup, Macros } from './groups';
import { scaleDay } from './portions';

/** Plan de comidas determinista (respaldo sin IA): plantillas por comida con alimentos básicos rotados. */

export type Budget = 'low' | 'medium' | 'high';
export type PlannerRole = 'protein' | 'carb' | 'legume' | 'veg' | 'fat' | 'fruit' | 'dairy';

export type PlannerFood = {
  id: string;
  name: string;
  per100: Macros;
  group: FoodGroup | null;
  /** Etiquetas: breakfast, main, snack, cook, cost:1–3, role:<PlannerRole>. */
  tags: string[];
  /** Porción típica en gramos. */
  defaultGrams: number;
};

export type MealPlanMeal = { name: string; items: { foodId: string; grams: number }[] };
export type MealPlanDay = { meals: MealPlanMeal[] };

export const MEAL_NAMES_ES: Record<number, string[]> = {
  2: ['Comida', 'Cena'],
  3: ['Desayuno', 'Comida', 'Cena'],
  4: ['Desayuno', 'Comida', 'Colación', 'Cena'],
  5: ['Desayuno', 'Colación matutina', 'Comida', 'Colación vespertina', 'Cena'],
  6: ['Desayuno', 'Colación matutina', 'Comida', 'Colación vespertina', 'Cena', 'Colación nocturna'],
};

type Kind = 'breakfast' | 'main' | 'dinner' | 'snack';

const TEMPLATE: Record<Kind, PlannerRole[]> = {
  breakfast: ['protein', 'carb', 'fruit'],
  main: ['protein', 'carb', 'legume', 'veg', 'fat'],
  dinner: ['protein', 'carb', 'veg'],
  snack: ['dairy', 'fruit'],
};

const kindOf = (name: string): Kind => {
  if (name.startsWith('Desayuno')) return 'breakfast';
  if (name.startsWith('Comida')) return 'main';
  if (name.startsWith('Cena')) return 'dinner';
  return 'snack';
};

const costOf = (f: PlannerFood) => Number(f.tags.find((t) => t.startsWith('cost:'))?.slice(5) ?? 2);
const MAX_COST: Record<Budget, number> = { low: 1, medium: 2, high: 3 };

function pool(foods: PlannerFood[], role: PlannerRole, kind: Kind, budget: Budget, cooks: boolean): PlannerFood[] {
  const mealTag = kind === 'dinner' ? 'main' : kind;
  const base = foods.filter((f) => f.tags.includes(`role:${role}`));
  const filters: ((f: PlannerFood) => boolean)[] = [
    (f) => f.tags.includes(mealTag) && costOf(f) <= MAX_COST[budget] && (cooks || !f.tags.includes('cook')),
    (f) => f.tags.includes(mealTag) && (cooks || !f.tags.includes('cook')),
    (f) => f.tags.includes(mealTag),
    () => true,
  ];
  for (const filter of filters) {
    const list = base.filter(filter);
    if (list.length > 0) return list;
  }
  return [];
}

export type TemplatePlanInput = {
  foods: PlannerFood[];
  mealsPerDay: number;
  days: number;
  budget: Budget;
  cooks: boolean;
  excludedIds?: Set<string>;
  target: { kcal: number; proteinG: number };
};

export function templateMealPlan(input: TemplatePlanInput): { days: MealPlanDay[]; ok: boolean } {
  const foods = input.foods.filter((f) => !input.excludedIds?.has(f.id));
  const names = MEAL_NAMES_ES[Math.min(6, Math.max(2, input.mealsPerDay))] ?? (MEAL_NAMES_ES[3] as string[]);
  const byId = new Map(foods.map((f) => [f.id, f]));
  const days: MealPlanDay[] = [];
  let allOk = true;
  for (let d = 0; d < input.days; d += 1) {
    // Sin repetir alimento en el mismo día (salvo que no haya alternativa).
    const used = new Set<string>();
    const meals = names.map((name, m) => {
      const kind = kindOf(name);
      const items: { foodId: string; grams: number }[] = [];
      for (const [r, role] of TEMPLATE[kind].entries()) {
        const all = pool(foods, role, kind, input.budget, input.cooks);
        const fresh = all.filter((f) => !used.has(f.id));
        const list = fresh.length > 0 ? fresh : all;
        if (list.length === 0) continue;
        // Rotación determinista: cada día y cada comida avanzan por la lista.
        const pick = list[(d * 3 + m * 2 + r) % list.length] as PlannerFood;
        used.add(pick.id);
        items.push({ foodId: pick.id, grams: pick.defaultGrams });
      }
      return { name, items };
    });
    const flat = meals.flatMap((meal, m) => meal.items.map((i, k) => ({ ...i, m, k, per100: byId.get(i.foodId)?.per100 as Macros, group: byId.get(i.foodId)?.group ?? null })));
    const scaled = scaleDay(flat, input.target);
    allOk &&= scaled.ok;
    for (const s of scaled.items) {
      const target = meals[s.m]?.items[s.k];
      if (target) target.grams = s.grams;
    }
    days.push({ meals });
  }
  return { days, ok: allOk };
}

/** Repite los días disponibles hasta completar la semana (el LLM puede proponer menos de 7). */
export function fillWeek(days: MealPlanDay[], length = 7): MealPlanDay[] {
  if (days.length === 0) return [];
  return Array.from({ length }, (_, i) => structuredClone(days[i % days.length] as MealPlanDay));
}
