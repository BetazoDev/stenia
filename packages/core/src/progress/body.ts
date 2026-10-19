import type { Sex } from '../schemas/common';

/** % de grasa por la fórmula de la Marina de EE.UU. (cm), sección 9.2 del PRD. */
export function navyBodyFat(input: { sex: Sex; heightCm: number; waistCm: number; neckCm: number; hipCm?: number | null }): number | null {
  const { sex, heightCm, waistCm, neckCm, hipCm } = input;
  if (heightCm <= 0 || waistCm <= 0 || neckCm <= 0) return null;
  let pct: number;
  if (sex === 'male') {
    const diff = waistCm - neckCm;
    if (diff <= 0) return null;
    pct = 495 / (1.0324 - 0.19077 * Math.log10(diff) + 0.15456 * Math.log10(heightCm)) - 450;
  } else {
    if (!hipCm || hipCm <= 0) return null;
    const sum = waistCm + hipCm - neckCm;
    if (sum <= 0) return null;
    pct = 495 / (1.29579 - 0.35004 * Math.log10(sum) + 0.221 * Math.log10(heightCm)) - 450;
  }
  if (!Number.isFinite(pct) || pct < 2 || pct > 70) return null;
  return Math.round(pct * 10) / 10;
}

export function leanMassKg(weightKg: number, bodyFatPct: number): number {
  return Math.round(weightKg * (1 - bodyFatPct / 100) * 10) / 10;
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}
