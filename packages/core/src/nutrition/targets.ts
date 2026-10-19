import type { ActivityLevel } from '../questionnaire';
import type { Goal, Sex } from '../schemas/common';

/** Metas calóricas y de macros (sección 10 del PRD). El código decide; el LLM nunca calcula metas. */

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function mifflinStJeor(input: { sex: Sex; weightKg: number; heightCm: number; age: number }): number {
  return 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + (input.sex === 'male' ? 5 : -161);
}

export function katchMcArdle(leanMassKg: number): number {
  return 370 + 21.6 * leanMassKg;
}

export type HealthFlags = { pregnant?: boolean; lactating?: boolean; diabetes?: boolean; kidneyDisease?: boolean; eatingDisorderHistory?: boolean };

export const HEALTH_FLAG_LABELS_ES: Record<keyof HealthFlags, string> = {
  pregnant: 'Embarazo',
  lactating: 'Lactancia',
  diabetes: 'Diabetes',
  kidneyDisease: 'Enfermedad renal',
  eatingDisorderHistory: 'Historial de trastornos de la conducta alimentaria',
};

/** Salvaguardas: con cualquiera de estas condiciones no se generan metas ni planes; se deriva a un profesional. */
export function nutritionBlockers(flags: HealthFlags): (keyof HealthFlags)[] {
  return (Object.keys(HEALTH_FLAG_LABELS_ES) as (keyof HealthFlags)[]).filter((k) => flags[k] === true);
}

export type NutritionLimits = { minKcal?: number | undefined; maxWeeklyLossPct?: number | undefined };

/** Valores por defecto conservadores (configurables por el usuario). */
export const DEFAULT_MAX_WEEKLY_LOSS_PCT = 0.75;
export const defaultMinKcal = (sex: Sex) => (sex === 'female' ? 1200 : 1500);

export type TargetInput = {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: Goal;
  bodyFatPct?: number | null;
  leanMassKg?: number | null;
  bmrMeasured?: number | null;
  /** Gasto adaptativo calculado con ≥ 14 días de registro (kcal/día). */
  adaptiveTdee?: number | null;
  limits?: NutritionLimits;
  /** Ajuste aceptado en revisiones (kcal/día). */
  kcalAdjustment?: number;
};

export type TargetMethod = 'mifflin' | 'katch' | 'measured' | 'adaptive';

export const TARGET_METHOD_LABELS_ES: Record<TargetMethod, string> = {
  mifflin: 'Mifflin-St Jeor × actividad',
  katch: 'Katch-McArdle (con % de grasa)',
  measured: 'TMB medida',
  adaptive: 'Gasto adaptativo (tu registro)',
};

export type Targets = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  bmr: number;
  tdee: number;
  method: TargetMethod;
  rationale: string[];
};

const GOAL_FACTOR: Record<Goal, number> = {
  fat_loss: -0.2,
  recomposition: -0.1,
  hypertrophy: 0.1,
  strength: 0.05,
  skills: 0,
};

/** Proteína por kg (ISSN): 1.4–2.0 g/kg; en déficit con fuerza, 2.3–3.1 g/kg (se usa el extremo bajo). */
const PROTEIN_PER_KG: Record<Goal, number> = {
  fat_loss: 2.3,
  recomposition: 2.2,
  hypertrophy: 1.8,
  strength: 1.8,
  skills: 1.6,
};

const round10 = (n: number) => Math.round(n / 10) * 10;

export function computeTargets(input: TargetInput): Targets {
  const rationale: string[] = [];
  let bmr: number;
  let method: TargetMethod;
  const lean = input.leanMassKg ?? (input.bodyFatPct ? input.weightKg * (1 - input.bodyFatPct / 100) : null);
  if (input.bmrMeasured && input.bmrMeasured > 800) {
    bmr = input.bmrMeasured;
    method = 'measured';
    rationale.push(`TMB medida: ${Math.round(bmr)} kcal.`);
  } else if (lean) {
    bmr = katchMcArdle(lean);
    method = 'katch';
    rationale.push(`TMB con Katch-McArdle (masa magra ${Math.round(lean * 10) / 10} kg): ${Math.round(bmr)} kcal.`);
  } else {
    bmr = mifflinStJeor(input);
    method = 'mifflin';
    rationale.push(`TMB con Mifflin-St Jeor: ${Math.round(bmr)} kcal.`);
  }
  let tdee = bmr * ACTIVITY_FACTORS[input.activity];
  if (input.adaptiveTdee && input.adaptiveTdee > 1000) {
    tdee = input.adaptiveTdee;
    method = 'adaptive';
    rationale.push(`Gasto adaptativo de tu registro: ${Math.round(tdee)} kcal/día.`);
  } else {
    rationale.push(`Gasto estimado × ${ACTIVITY_FACTORS[input.activity]} por actividad: ${Math.round(tdee)} kcal.`);
  }

  let kcal = tdee * (1 + GOAL_FACTOR[input.goal]);
  const maxLossPct = input.limits?.maxWeeklyLossPct ?? DEFAULT_MAX_WEEKLY_LOSS_PCT;
  const maxDeficit = (input.weightKg * (maxLossPct / 100) * 7700) / 7;
  if (tdee - kcal > maxDeficit) {
    kcal = tdee - maxDeficit;
    rationale.push(`Déficit limitado a ${maxLossPct}% del peso por semana (${Math.round(maxDeficit)} kcal/día).`);
  }
  if (input.kcalAdjustment) {
    kcal += input.kcalAdjustment;
    rationale.push(`Ajuste de revisiones: ${input.kcalAdjustment > 0 ? '+' : ''}${input.kcalAdjustment} kcal.`);
  }
  const floor = Math.max(input.limits?.minKcal ?? defaultMinKcal(input.sex), Math.round(bmr * 0.95));
  if (kcal < floor) {
    kcal = floor;
    rationale.push(`Piso de calorías aplicado: ${floor} kcal.`);
  }
  kcal = round10(kcal);

  // Con obesidad, la proteína se calcula sobre un peso de referencia (IMC 27) para no exagerarla.
  const bmi = input.weightKg / (input.heightCm / 100) ** 2;
  const refWeight = bmi > 30 ? 27 * (input.heightCm / 100) ** 2 : input.weightKg;
  const proteinG = Math.round(refWeight * PROTEIN_PER_KG[input.goal]);
  const fatG = Math.round(Math.max(input.weightKg * 0.6, (kcal * 0.25) / 9));
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
  rationale.push(`Proteína ${PROTEIN_PER_KG[input.goal]} g/kg${refWeight !== input.weightKg ? ' de peso de referencia' : ''} (ISSN); grasa ≥ 25% de las kcal; el resto, carbohidratos.`);
  return { kcal, proteinG, carbsG, fatG, bmr: Math.round(bmr), tdee: Math.round(tdee), method, rationale };
}

/**
 * Gasto adaptativo: ingesta promedio − energía del cambio de peso suavizado (7,700 kcal/kg).
 * Solo días con registro completo; requiere al menos `minDays` días.
 */
export function adaptiveTdee(
  intake: { date: string; kcal: number }[],
  trend: { date: string; value: number }[],
  options: { minDays?: number; minKcalPerDay?: number } = {},
): { tdee: number; days: number; avgIntake: number; changeKgPerWeek: number } | null {
  const minDays = options.minDays ?? 14;
  const complete = intake.filter((d) => d.kcal >= (options.minKcalPerDay ?? 800)).sort((a, b) => a.date.localeCompare(b.date));
  if (complete.length < minDays) return null;
  const first = complete[0]?.date as string;
  const last = complete[complete.length - 1]?.date as string;
  const inRange = trend.filter((t) => t.date >= first && t.date <= last).sort((a, b) => a.date.localeCompare(b.date));
  if (inRange.length < 2) return null;
  const startW = inRange[0]?.value as number;
  const endW = inRange[inRange.length - 1]?.value as number;
  const spanDays = Math.max(1, (Date.parse(`${inRange[inRange.length - 1]?.date}T12:00:00Z`) - Date.parse(`${inRange[0]?.date}T12:00:00Z`)) / 86_400_000);
  if (spanDays < minDays - 1) return null;
  const avgIntake = complete.reduce((a, d) => a + d.kcal, 0) / complete.length;
  const tdee = avgIntake - ((endW - startW) * 7700) / spanDays;
  return { tdee: Math.round(tdee), days: complete.length, avgIntake: Math.round(avgIntake), changeKgPerWeek: Math.round(((endW - startW) / spanDays) * 7 * 100) / 100 };
}
