import { macrosFor, sumMacros, type FoodGroup, type Macros } from './groups';

/** Ajuste de porciones del plan: ±5% de kcal con la proteína cubierta (sección 10). */

export type PlanItem = { foodId: string; grams: number; per100: Macros; group: FoodGroup | null };
export type ScaleResult<T extends PlanItem> = { items: T[]; totals: Macros; ok: boolean; kcalErrorPct: number };

const PROTEIN_DENSE = (i: PlanItem) => i.per100.kcal > 0 && (i.per100.proteinG * 4) / i.per100.kcal >= 0.3;
const MIN_G = 10;
const MAX_G = 600;
/** Topes realistas por porción según el grupo (no se resuelve un día con medio kilo de fruta). */
const GROUP_MAX: Partial<Record<FoodGroup, number>> = { fruit: 250, vegetable: 300, fat: 45, dairy: 480, sugar: 40, free: 300, protein: 280, legume: 300 };
const maxFor = (i: PlanItem) => (i.group ? (GROUP_MAX[i.group] ?? MAX_G) : MAX_G);
const clamp = (i: PlanItem, g: number) => Math.min(maxFor(i), Math.max(MIN_G, g));
const step = (g: number) => (g >= 100 ? Math.round(g / 10) * 10 : Math.round(g / 5) * 5);

function totalsOf(items: PlanItem[]): Macros {
  return sumMacros(items.map((i) => macrosFor(i.per100, i.grams)));
}

/**
 * Escala gramos de un día de plan. Primero cubre la proteína con los alimentos ricos en proteína; después ajusta
 * las kcal con el resto (cereales, grasas, frutas…). Redondea a 5–10 g y respeta 10–600 g por alimento.
 */
export function scaleDay<T extends PlanItem>(input: T[], target: { kcal: number; proteinG: number }, maxIterations = 30): ScaleResult<T> {
  const items = input.map((i) => ({ ...i, grams: Math.min(MAX_G, Math.max(MIN_G, i.grams)) }));
  for (const i of items) i.grams = Math.min(i.grams, maxFor(i));
  const proteinItems = items.filter(PROTEIN_DENSE);
  const flexItems = items.filter((i) => !PROTEIN_DENSE(i) && i.group !== 'vegetable' && i.group !== 'free');

  for (let iter = 0; iter < maxIterations; iter += 1) {
    let t = totalsOf(items);
    const proteinGap = target.proteinG - t.proteinG;
    if (proteinGap > 1 && proteinItems.length > 0) {
      const pPool = proteinItems.reduce((a, i) => a + (i.per100.proteinG * i.grams) / 100, 0);
      const factor = pPool > 0 ? Math.min(1.6, 1 + proteinGap / pPool) : 1;
      for (const i of proteinItems) i.grams = clamp(i, i.grams * factor);
    } else if (proteinGap < -target.proteinG * 0.25 && proteinItems.length > 0) {
      // Demasiada proteína desplaza carbohidratos: recorta un poco.
      for (const i of proteinItems) i.grams = Math.max(MIN_G, i.grams * 0.92);
    }
    t = totalsOf(items);
    const kcalGap = target.kcal - t.kcal;
    if (Math.abs(kcalGap) <= target.kcal * 0.03 && t.proteinG >= target.proteinG * 0.97) break;
    const base = flexItems.length > 0 ? flexItems : items;
    // Al subir, solo crecen los que aún no llegan a su tope; si todos llegaron, también los proteicos.
    let pool = kcalGap > 0 ? base.filter((i) => i.grams < maxFor(i) - 1) : base;
    if (pool.length === 0 && kcalGap > 0) pool = items.filter((i) => i.grams < maxFor(i) - 1);
    const flexKcal = pool.reduce((a, i) => a + (i.per100.kcal * i.grams) / 100, 0);
    if (flexKcal <= 0) break;
    const factor = Math.min(1.8, Math.max(0.5, 1 + kcalGap / flexKcal));
    for (const i of pool) i.grams = clamp(i, i.grams * factor);
  }
  for (const i of items) i.grams = clamp(i, step(i.grams));
  const totals = totalsOf(items);
  const kcalErrorPct = target.kcal > 0 ? (totals.kcal - target.kcal) / target.kcal : 0;
  return { items, totals, ok: Math.abs(kcalErrorPct) <= 0.05 && totals.proteinG >= target.proteinG * 0.95, kcalErrorPct };
}

/** Lista de compras: gramos totales por alimento en la semana, redondeados hacia arriba a 50 g (o piezas). */
export function shoppingList(
  days: { meals: { items: { foodId: string; grams: number }[] }[] }[],
  foods: Map<string, { name: string; group: FoodGroup | null; unit?: { label: string; grams: number } | null }>,
): { foodId: string; name: string; group: FoodGroup | null; grams: number; display: string }[] {
  const totals = new Map<string, number>();
  for (const d of days) for (const m of d.meals) for (const i of m.items) totals.set(i.foodId, (totals.get(i.foodId) ?? 0) + i.grams);
  return [...totals.entries()]
    .map(([foodId, grams]) => {
      const f = foods.get(foodId);
      const unit = f?.unit;
      const rounded = Math.ceil(grams / 50) * 50;
      const display =
        unit && unit.grams > 0
          ? `${Math.ceil(grams / unit.grams)} × ${unit.label} (${Math.round(grams)} g)`
          : rounded >= 1000
            ? `${(rounded / 1000).toLocaleString('es-MX')} kg`
            : `${rounded} g`;
      return { foodId, name: f?.name ?? foodId, group: f?.group ?? null, grams: Math.round(grams), display };
    })
    .sort((a, b) => (a.group ?? 'z').localeCompare(b.group ?? 'z') || a.name.localeCompare(b.name));
}

/**
 * Sustitutos de un alimento: mismo grupo, perfil de macros parecido; los gramos conservan las kcal
 * (o la proteína en alimentos proteicos).
 */
export function substitutesFor<T extends { id: string; per100: Macros; group: FoodGroup | null }>(
  item: { id: string; grams: number; per100: Macros; group: FoodGroup | null },
  candidates: T[],
  limit = 6,
): (T & { grams: number; distance: number })[] {
  const portion = macrosFor(item.per100, item.grams);
  const share = (m: Macros) => {
    const k = Math.max(1, m.kcal);
    return [(m.proteinG * 4) / k, (m.carbsG * 4) / k, (m.fatG * 9) / k];
  };
  const ref = share(item.per100);
  const byProtein = PROTEIN_DENSE({ foodId: item.id, grams: item.grams, per100: item.per100, group: item.group });
  return candidates
    .filter((c) => c.id !== item.id && c.group === item.group && c.per100.kcal > 0)
    .map((c) => {
      const s = share(c.per100);
      const distance = Math.hypot((s[0] ?? 0) - (ref[0] ?? 0), (s[1] ?? 0) - (ref[1] ?? 0), (s[2] ?? 0) - (ref[2] ?? 0));
      const grams = byProtein && c.per100.proteinG > 0 ? (portion.proteinG / c.per100.proteinG) * 100 : (portion.kcal / c.per100.kcal) * 100;
      return { ...c, grams: Math.min(MAX_G, Math.max(MIN_G, step(grams))), distance };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}
