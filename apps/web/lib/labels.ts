import { MUSCLE_LABELS_ES, type MuscleGroup } from '@stenia/core';

export const PATTERN_LABELS_ES: Record<string, string> = {
  horizontal_push: 'Empuje horizontal',
  vertical_push: 'Empuje vertical',
  horizontal_pull: 'Tirón horizontal',
  vertical_pull: 'Tirón vertical',
  squat: 'Sentadilla',
  hinge: 'Bisagra de cadera',
  lunge: 'Zancada',
  core: 'Core',
  carry: 'Acarreo',
  isolation: 'Aislamiento',
  skill: 'Habilidad',
  mobility: 'Movilidad',
  cardio: 'Cardio',
  explosive: 'Explosivo',
};

export const LOAD_TYPE_LABELS_ES: Record<string, string> = {
  external: 'Carga externa',
  bodyweight: 'Peso corporal',
  assisted: 'Asistido',
  weighted_bw: 'Lastrado',
  isometric: 'Isométrico',
};

export const LEVEL_LABELS: Record<string, string> = { beginner: 'Principiante', intermediate: 'Intermedio', advanced: 'Avanzado' };

export function musclesText(muscles: string[]): string {
  return muscles.map((m) => MUSCLE_LABELS_ES[m as MuscleGroup] ?? m).join(', ');
}

export function doseText(p: { sets: number; repMin: number | null; repMax: number | null; targetSeconds: number | null }): string {
  if (p.targetSeconds) return `${p.sets} × ${p.targetSeconds} s`;
  if (p.repMin !== null && p.repMax !== null) return `${p.sets} × ${p.repMin === p.repMax ? p.repMin : `${p.repMin}–${p.repMax}`}`;
  return `${p.sets} series`;
}

export function restText(seconds: number): string {
  if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60} min`;
  if (seconds > 60) return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
  return `${seconds} s`;
}
