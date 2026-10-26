/**
 * Unidades de peso. Todo se guarda en kilogramos; la preferencia (kg o lb) solo cambia cómo se muestra y se
 * captura. La columna `user.units` guarda 'metric' (kg) o 'imperial' (lb).
 */
export type WeightUnit = 'kg' | 'lb';

export const KG_PER_LB = 0.45359237;

export function weightUnitFrom(units: string | null | undefined): WeightUnit {
  return units === 'imperial' ? 'lb' : 'kg';
}

export function unitsColumnFor(unit: WeightUnit): 'metric' | 'imperial' {
  return unit === 'lb' ? 'imperial' : 'metric';
}

/** Kilogramos → la unidad elegida, redondeado a 0.1 (lb) o 0.01 (kg). */
export function kgToUnit(kg: number, unit: WeightUnit): number {
  if (unit === 'kg') return Math.round(kg * 100) / 100;
  return Math.round((kg / KG_PER_LB) * 10) / 10;
}

/** Valor capturado en la unidad elegida → kilogramos (con precisión suficiente para volver al mismo número en lb). */
export function unitToKg(value: number, unit: WeightUnit): number {
  if (unit === 'kg') return value;
  return Math.round(value * KG_PER_LB * 1000) / 1000;
}

const formatter = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1, minimumFractionDigits: 0 });
const kgFormatter = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** Número sin unidad en la unidad elegida: 60 kg → "60" o "132.3". */
export function weightNumber(kg: number, unit: WeightUnit): string {
  return (unit === 'kg' ? kgFormatter : formatter).format(kgToUnit(kg, unit));
}

/** Peso con unidad: 60 kg → "60 kg" o "132.3 lb". */
export function formatWeight(kg: number, unit: WeightUnit): string {
  return `${weightNumber(kg, unit)} ${unit}`;
}

/** Paso del selector de peso en la unidad elegida: 2.5 kg → 5 lb, 5 kg → 10 lb, 1.25 kg → 2.5 lb. */
export function weightStepIn(kgStep: number, unit: WeightUnit): number {
  if (unit === 'kg') return kgStep;
  const lb = kgStep / KG_PER_LB;
  return Math.max(1, Math.round(lb / 2.5) * 2.5);
}
