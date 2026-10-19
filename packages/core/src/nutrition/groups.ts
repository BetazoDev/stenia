import { z } from 'zod';

/** Grupos del sistema de equivalentes (inspirado en el SMAE) más «libres» y «platillos». */
export const FoodGroup = z.enum(['protein', 'cereal', 'legume', 'dairy', 'vegetable', 'fruit', 'fat', 'sugar', 'free', 'mixed']);
export type FoodGroup = z.infer<typeof FoodGroup>;

export const FOOD_GROUP_LABELS_ES: Record<FoodGroup, string> = {
  protein: 'Origen animal',
  cereal: 'Cereales y tubérculos',
  legume: 'Leguminosas',
  dairy: 'Leche y yogur',
  vegetable: 'Verduras',
  fruit: 'Frutas',
  fat: 'Grasas',
  sugar: 'Azúcares',
  free: 'Libres',
  mixed: 'Platillos',
};

export type Macros = { kcal: number; proteinG: number; carbsG: number; fatG: number };

/**
 * Aporte de un equivalente por grupo (valores redondeados del Sistema Mexicano de Alimentos Equivalentes).
 * `basis` es el macronutriente que define el equivalente del grupo.
 */
export const EQUIVALENTS: Partial<Record<FoodGroup, Macros & { basis: 'proteinG' | 'carbsG' | 'fatG' }>> = {
  cereal: { kcal: 70, proteinG: 2, carbsG: 15, fatG: 0, basis: 'carbsG' },
  legume: { kcal: 120, proteinG: 8, carbsG: 20, fatG: 1, basis: 'carbsG' },
  protein: { kcal: 75, proteinG: 7, carbsG: 0, fatG: 5, basis: 'proteinG' },
  dairy: { kcal: 110, proteinG: 9, carbsG: 12, fatG: 4, basis: 'proteinG' },
  vegetable: { kcal: 25, proteinG: 2, carbsG: 4, fatG: 0, basis: 'carbsG' },
  fruit: { kcal: 60, proteinG: 0, carbsG: 15, fatG: 0, basis: 'carbsG' },
  fat: { kcal: 45, proteinG: 0, carbsG: 0, fatG: 5, basis: 'fatG' },
  sugar: { kcal: 40, proteinG: 0, carbsG: 10, fatG: 0, basis: 'carbsG' },
};

/** Macros de una porción a partir de los valores por 100 g. */
export function macrosFor(per100: Macros, grams: number): Macros {
  const f = grams / 100;
  return { kcal: per100.kcal * f, proteinG: per100.proteinG * f, carbsG: per100.carbsG * f, fatG: per100.fatG * f };
}

export function sumMacros(list: Macros[]): Macros {
  return list.reduce((a, m) => ({ kcal: a.kcal + m.kcal, proteinG: a.proteinG + m.proteinG, carbsG: a.carbsG + m.carbsG, fatG: a.fatG + m.fatG }), {
    kcal: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
  });
}

export function roundMacros(m: Macros): Macros {
  return { kcal: Math.round(m.kcal), proteinG: Math.round(m.proteinG), carbsG: Math.round(m.carbsG), fatG: Math.round(m.fatG) };
}

/** Equivalentes de una porción (múltiplos de 0.5). Null para grupos sin equivalente (libres, platillos). */
export function equivalentsFor(group: FoodGroup | null | undefined, portion: Macros): number | null {
  const eq = group ? EQUIVALENTS[group] : undefined;
  if (!eq) return null;
  const value = portion[eq.basis] / eq[eq.basis];
  return Math.max(0, Math.round(value * 2) / 2);
}
