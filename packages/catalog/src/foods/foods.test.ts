import { describe, expect, it } from 'vitest';

import { translateExerciseName } from '../translate-exercise';
import { foodGroupFor } from './classify';
import { STAPLES } from './staples';
import { translateFoodName } from './translate';
import { buildCompactFoods, type UsdaFood } from './usda';

describe('nombres de alimentos', () => {
  it('traduce descripciones USDA comunes', () => {
    expect(translateFoodName('Chicken, broilers or fryers, breast, meat only, cooked, roasted')).toBe('Pollo, pollo de engorda, pechuga, solo carne, cocido, asado');
    expect(translateFoodName('Beans, black, mature seeds, cooked, boiled, without salt')).toBe('Frijoles, negro, semillas maduras, cocido, hervido, sin sal');
    expect(translateFoodName('Rice, white, long-grain, regular, enriched, cooked')).toMatch(/^Arroz, blanco/);
  });
});

describe('grupos de equivalentes', () => {
  it('clasifica por categoría y descripción', () => {
    expect(foodGroupFor('Poultry Products', 'Chicken, breast')).toBe('protein');
    expect(foodGroupFor('Dairy and Egg Products', 'Milk, whole')).toBe('dairy');
    expect(foodGroupFor('Dairy and Egg Products', 'Cheese, cheddar')).toBe('protein');
    expect(foodGroupFor('Dairy and Egg Products', 'Butter, salted')).toBe('fat');
    expect(foodGroupFor('Vegetables and Vegetable Products', 'Potatoes, boiled')).toBe('cereal');
    expect(foodGroupFor('Vegetables and Vegetable Products', 'Spinach, raw')).toBe('vegetable');
    expect(foodGroupFor('Legumes and Legume Products', 'Peanut butter, smooth')).toBe('fat');
    expect(foodGroupFor('Legumes and Legume Products', 'Beans, black, cooked')).toBe('legume');
    expect(foodGroupFor('Baked Products', 'Cookies, oatmeal')).toBe('sugar');
    expect(foodGroupFor('Beverages', 'Beverages, coffee, brewed')).toBe('free');
  });
});

describe('archivo compacto USDA', () => {
  const nutrients = (kcal: number, p: number, c: number, f: number) => [
    { nutrient: { id: 1008 }, amount: kcal },
    { nutrient: { id: 1003 }, amount: p },
    { nutrient: { id: 1005 }, amount: c },
    { nutrient: { id: 1004 }, amount: f },
  ];
  const staplesAsFoods: UsdaFood[] = STAPLES.map((s) => ({ fdcId: s.fdcId, description: `Staple ${s.fdcId}`, foodCategory: { description: 'Poultry Products' }, foodNutrients: nutrients(100, 10, 5, 3) }));

  it('aplica nombres revisados a los básicos, deduplica y prefiere Foundation', () => {
    const sr: UsdaFood[] = [
      ...staplesAsFoods,
      { fdcId: 1, description: 'Kale, raw', foodCategory: { description: 'Vegetables and Vegetable Products' }, foodNutrients: nutrients(49, 4.3, 8.8, 0.9), foodPortions: [{ amount: 1, modifier: 'cup, chopped', gramWeight: 16 }] },
      { fdcId: 2, description: 'Baby food, peas', foodCategory: { description: 'Baby Foods' }, foodNutrients: nutrients(40, 3, 6, 0) },
    ];
    const foundation: UsdaFood[] = [{ fdcId: 3, description: 'Kale, raw', foodCategory: { description: 'Vegetables and Vegetable Products' }, foodNutrients: [{ nutrient: { id: 2047 }, amount: 35 }, { nutrient: { id: 1003 }, amount: 2.9 }] }];
    const out = buildCompactFoods(
      [
        { label: 'F', foods: foundation, preferred: true },
        { label: 'SR', foods: sr, preferred: false },
      ],
      '2026-10-19T00:00:00.000Z',
    );
    expect(out.foods.find((f) => f[0] === 2)).toBeUndefined();
    const kale = out.foods.filter((f) => f[1] === 'Kale, raw');
    expect(kale).toHaveLength(1);
    expect(kale[0]?.[0]).toBe(3);
    expect(kale[0]?.[4]).toBe(35);
    const chicken = out.foods.find((f) => f[0] === 171477);
    expect(chicken?.[2]).toBe('Pechuga de pollo asada, sin piel');
    expect(chicken?.[11]).toBe(1);
    expect(chicken?.[10]).toContain('staple');
  });

  it('falla si falta un básico', () => {
    expect(() => buildCompactFoods([{ label: 'SR', foods: [], preferred: false }])).toThrow(/básicos/);
  });
});

describe('nombres de ejercicios', () => {
  it('mueve el equipo al final y concuerda el género', () => {
    expect(translateExerciseName('Dumbbell Bench Press')).toBe('Press de banca con mancuernas');
    expect(translateExerciseName('Barbell Full Squat')).toBe('Sentadilla completa con barra');
    expect(translateExerciseName('Incline Hammer Curls')).toBe('Curl martillo inclinado');
    expect(translateExerciseName('Split Squat with Dumbbells')).toBe('Sentadilla dividida con mancuernas');
    expect(translateExerciseName('Close-Grip Push-Up')).toBe('Lagartija agarre cerrado');
    expect(translateExerciseName('Ring Dips')).toBe('Fondos en anillas');
    expect(translateExerciseName('Seated Good Mornings')).toBe('Buenos días sentados');
  });
});
