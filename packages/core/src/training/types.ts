import type { LoadType } from '../schemas/common';

/** Meta mostrada al registrar una serie (se guarda junto a la serie para comparar meta vs. real). */
export type SetTarget = {
  weightKg?: number | null;
  assistanceKg?: number | null;
  addedWeightKg?: number | null;
  repMin?: number | null;
  repMax?: number | null;
  seconds?: number | null;
};

export type LoggedSet = {
  weightKg: number | null;
  assistanceKg: number | null;
  addedWeightKg: number | null;
  reps: number | null;
  seconds: number | null;
  rir: number | null;
  completed: boolean;
  target?: SetTarget | null;
};

export type ExerciseSession = {
  /** ISO de la sesión (para ordenar y mostrar). */
  date: string;
  exerciseId: string;
  sets: LoggedSet[];
};

export type Prescribed = {
  loadType: LoadType;
  sets: number;
  repMin: number | null;
  repMax: number | null;
  targetSeconds: number | null;
  rirTarget: number;
};
