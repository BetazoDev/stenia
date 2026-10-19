import { describe, expect, it } from 'vitest';

import { equivalentsFor, macrosFor, sumMacros, type Macros } from './groups';
import { fillWeek, templateMealPlan, type PlannerFood } from './planner';
import { scaleDay, shoppingList, substitutesFor } from './portions';
import { adaptiveTdee, computeTargets, katchMcArdle, mifflinStJeor, nutritionBlockers } from './targets';

const m = (kcal: number, p: number, c: number, f: number): Macros => ({ kcal, proteinG: p, carbsG: c, fatG: f });

describe('metas', () => {
  it('Mifflin-St Jeor y Katch-McArdle', () => {
    expect(mifflinStJeor({ sex: 'male', weightKg: 80, heightCm: 178, age: 30 })).toBe(800 + 1112.5 - 150 + 5);
    expect(mifflinStJeor({ sex: 'female', weightKg: 60, heightCm: 165, age: 30 })).toBe(600 + 1031.25 - 150 - 161);
    expect(katchMcArdle(65)).toBeCloseTo(370 + 21.6 * 65);
  });

  it('hipertrofia: superávit moderado y proteína 1.8 g/kg', () => {
    const t = computeTargets({ sex: 'male', age: 30, heightCm: 178, weightKg: 80, activity: 'moderate', goal: 'hypertrophy' });
    expect(t.method).toBe('mifflin');
    expect(t.tdee).toBe(Math.round(1767.5 * 1.55));
    expect(t.kcal).toBe(Math.round((1767.5 * 1.55 * 1.1) / 10) * 10);
    expect(t.proteinG).toBe(144);
    expect(t.fatG * 9).toBeGreaterThanOrEqual(t.kcal * 0.25 - 9);
    expect(Math.abs(t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9 - t.kcal)).toBeLessThan(10);
  });

  it('pérdida de grasa: limita el déficit y respeta el piso', () => {
    const t = computeTargets({ sex: 'female', age: 35, heightCm: 160, weightKg: 58, activity: 'sedentary', goal: 'fat_loss', limits: { maxWeeklyLossPct: 0.5 } });
    const maxDeficit = (58 * 0.005 * 7700) / 7;
    expect(t.tdee - t.kcal).toBeLessThanOrEqual(Math.round(maxDeficit) + 10);
    expect(t.kcal).toBeGreaterThanOrEqual(1200);
    expect(t.proteinG).toBe(Math.round(58 * 2.3));
  });

  it('usa TMB medida, Katch con % de grasa y gasto adaptativo en ese orden de preferencia', () => {
    const base = { sex: 'male' as const, age: 30, heightCm: 178, weightKg: 80, activity: 'moderate' as const, goal: 'skills' as const };
    expect(computeTargets({ ...base, bodyFatPct: 15 }).method).toBe('katch');
    expect(computeTargets({ ...base, bodyFatPct: 15, bmrMeasured: 1850 }).method).toBe('measured');
    expect(computeTargets({ ...base, adaptiveTdee: 2600 }).kcal).toBe(2600);
  });

  it('piso de calorías configurable', () => {
    const t = computeTargets({ sex: 'female', age: 40, heightCm: 150, weightKg: 48, activity: 'sedentary', goal: 'fat_loss', limits: { minKcal: 1400 } });
    expect(t.kcal).toBe(1400);
  });

  it('salvaguardas', () => {
    expect(nutritionBlockers({})).toEqual([]);
    expect(nutritionBlockers({ pregnant: true, diabetes: false, eatingDisorderHistory: true })).toEqual(['pregnant', 'eatingDisorderHistory']);
  });
});

describe('gasto adaptativo', () => {
  const days = (n: number, kcal: number) => Array.from({ length: n }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, kcal }));
  it('ingesta − cambio de peso × 7,700', () => {
    const trend = days(21, 0).map((d, i) => ({ date: d.date, value: 80 - (0.5 / 7) * i }));
    const r = adaptiveTdee(days(21, 2200), trend);
    expect(r).not.toBeNull();
    expect(r?.tdee).toBe(Math.round(2200 + (0.5 / 7) * 7700));
    expect(r?.changeKgPerWeek).toBeCloseTo(-0.5, 2);
  });
  it('requiere 14 días completos', () => {
    expect(adaptiveTdee(days(10, 2200), days(10, 0).map((d) => ({ date: d.date, value: 80 }))) ).toBeNull();
    expect(adaptiveTdee(days(20, 300), days(20, 0).map((d) => ({ date: d.date, value: 80 })))).toBeNull();
  });
});

describe('equivalentes', () => {
  it('cereal por carbohidratos, origen animal por proteína', () => {
    // 2 tortillas (60 g) ≈ 2 equivalentes de cereal.
    expect(equivalentsFor('cereal', macrosFor(m(218, 5.7, 44.6, 2.9), 60))).toBe(2);
    expect(equivalentsFor('protein', macrosFor(m(165, 31, 0, 3.6), 100))).toBe(4.5);
    expect(equivalentsFor('free', m(5, 0, 1, 0))).toBeNull();
  });
});

const chicken = { foodId: 'chicken', grams: 120, per100: m(165, 31, 0, 3.6), group: 'protein' as const };
const rice = { foodId: 'rice', grams: 150, per100: m(130, 2.7, 28, 0.3), group: 'cereal' as const };
const beans = { foodId: 'beans', grams: 100, per100: m(132, 8.9, 23.7, 0.5), group: 'legume' as const };
const avocado = { foodId: 'avocado', grams: 50, per100: m(167, 2, 8.6, 15.4), group: 'fat' as const };
const broccoli = { foodId: 'broccoli', grams: 100, per100: m(34, 2.8, 6.6, 0.4), group: 'vegetable' as const };
const eggs = { foodId: 'eggs', grams: 100, per100: m(143, 12.6, 0.7, 9.5), group: 'protein' as const };
const tortilla = { foodId: 'tortilla', grams: 60, per100: m(218, 5.7, 44.6, 2.9), group: 'cereal' as const };

describe('ajuste de porciones', () => {
  it('llega a ±5% de kcal con la proteína cubierta', () => {
    const r = scaleDay([chicken, rice, beans, avocado, broccoli, eggs, tortilla], { kcal: 2600, proteinG: 150 });
    expect(r.ok).toBe(true);
    expect(Math.abs(r.kcalErrorPct)).toBeLessThanOrEqual(0.05);
    expect(r.totals.proteinG).toBeGreaterThanOrEqual(150 * 0.95);
    for (const i of r.items) expect(i.grams % 5).toBe(0);
  });
  it('también reduce porciones si sobran calorías', () => {
    const big = [chicken, { ...rice, grams: 500 }, { ...avocado, grams: 200 }, { ...tortilla, grams: 300 }];
    const r = scaleDay(big, { kcal: 1600, proteinG: 120 });
    expect(r.totals.kcal).toBeLessThan(1600 * 1.06);
  });
});

describe('lista de compras y sustitutos', () => {
  it('suma gramos de la semana y usa piezas cuando existen', () => {
    const days = [{ meals: [{ items: [{ foodId: 'tortilla', grams: 90 }, { foodId: 'rice', grams: 120 }] }] }, { meals: [{ items: [{ foodId: 'tortilla', grams: 60 }] }] }];
    const list = shoppingList(
      days,
      new Map([
        ['tortilla', { name: 'Tortilla de maíz', group: 'cereal', unit: { label: 'tortilla', grams: 30 } }],
        ['rice', { name: 'Arroz', group: 'cereal', unit: null }],
      ]),
    );
    expect(list.find((l) => l.foodId === 'tortilla')?.display).toBe('5 × tortilla (150 g)');
    expect(list.find((l) => l.foodId === 'rice')?.display).toBe('150 g');
  });
  it('sustitutos del mismo grupo conservan la proteína', () => {
    const subs = substitutesFor(
      { id: 'chicken', grams: 120, per100: chicken.per100, group: 'protein' },
      [
        { id: 'tuna', per100: m(86, 19.4, 0, 0.9), group: 'protein' as const },
        { id: 'beef', per100: m(176, 20, 0, 10), group: 'protein' as const },
        { id: 'rice', per100: rice.per100, group: 'cereal' as const },
      ],
    );
    expect(subs.map((s) => s.id)).toEqual(['tuna', 'beef']);
    expect(subs[0]?.grams).toBe(190);
  });
});

describe('plan determinista', () => {
  const food = (id: string, per100: Macros, group: PlannerFood['group'], tags: string[], defaultGrams: number): PlannerFood => ({ id, name: id, per100, group, tags, defaultGrams });
  const foods: PlannerFood[] = [
    food('eggs', eggs.per100, 'protein', ['breakfast', 'role:protein', 'cost:1', 'cook'], 100),
    food('yogurt', m(59, 10, 3.6, 0.4), 'dairy', ['breakfast', 'snack', 'role:dairy', 'role:protein', 'cost:2'], 170),
    food('chicken', chicken.per100, 'protein', ['main', 'role:protein', 'cost:1', 'cook'], 120),
    food('tuna', m(86, 19.4, 0, 0.9), 'protein', ['main', 'role:protein', 'cost:2'], 100),
    food('tortilla', tortilla.per100, 'cereal', ['breakfast', 'main', 'role:carb', 'cost:1'], 60),
    food('rice', rice.per100, 'cereal', ['main', 'role:carb', 'cost:1', 'cook'], 150),
    food('beans', beans.per100, 'legume', ['main', 'role:legume', 'cost:1'], 100),
    food('broccoli', broccoli.per100, 'vegetable', ['main', 'role:veg', 'cost:1', 'cook'], 100),
    food('avocado', avocado.per100, 'fat', ['main', 'role:fat', 'cost:2'], 50),
    food('banana', m(89, 1.1, 22.8, 0.3), 'fruit', ['breakfast', 'snack', 'role:fruit', 'cost:1'], 120),
  ];
  it('arma días completos dentro de ±5% de kcal', () => {
    const plan = templateMealPlan({ foods, mealsPerDay: 4, days: 3, budget: 'medium', cooks: true, target: { kcal: 2400, proteinG: 150 } });
    expect(plan.days).toHaveLength(3);
    expect(plan.days[0]?.meals.map((x) => x.name)).toEqual(['Desayuno', 'Comida', 'Colación', 'Cena']);
    expect(plan.ok).toBe(true);
    const byId = new Map(foods.map((f) => [f.id, f]));
    const total = sumMacros(plan.days[0]?.meals.flatMap((x) => x.items.map((i) => macrosFor(byId.get(i.foodId)?.per100 as Macros, i.grams))) ?? []);
    expect(Math.abs(total.kcal - 2400) / 2400).toBeLessThanOrEqual(0.05);
  });
  it('respeta exclusiones y "no cocina"', () => {
    const plan = templateMealPlan({ foods, mealsPerDay: 3, days: 2, budget: 'low', cooks: false, excludedIds: new Set(['tuna']), target: { kcal: 2000, proteinG: 120 } });
    const ids = plan.days.flatMap((d) => d.meals.flatMap((x) => x.items.map((i) => i.foodId)));
    expect(ids).not.toContain('tuna');
  });
  it('completa la semana repitiendo días', () => {
    expect(fillWeek([{ meals: [] }, { meals: [{ name: 'Comida', items: [] }] }], 7)).toHaveLength(7);
  });
});

describe('topes por grupo', () => {
  it('la fruta no pasa de 250 g aunque falten calorías', () => {
    const melon = { foodId: 'melon', grams: 200, per100: m(34, 0.8, 8.2, 0.2), group: 'fruit' as const };
    const r = scaleDay([chicken, rice, melon], { kcal: 2400, proteinG: 120 });
    expect(r.items.find((i) => i.foodId === 'melon')?.grams).toBeLessThanOrEqual(250);
    expect(r.items.find((i) => i.foodId === 'rice')?.grams).toBeGreaterThan(150);
  });
});
