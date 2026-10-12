import { z } from 'zod';

/** Tipos de carga que entiende el motor de progresión (sección 6.1 del PRD). */
export const LoadType = z.enum(['external', 'bodyweight', 'assisted', 'weighted_bw', 'isometric']);
export type LoadType = z.infer<typeof LoadType>;

export const Sex = z.enum(['male', 'female']);
export type Sex = z.infer<typeof Sex>;

export const Goal = z.enum(['hypertrophy', 'strength', 'fat_loss', 'recomposition', 'skills']);
export type Goal = z.infer<typeof Goal>;

export const ExerciseLevel = z.enum(['beginner', 'intermediate', 'advanced']);
export type ExerciseLevel = z.infer<typeof ExerciseLevel>;

export const EquipmentCategory = z.enum(['machine', 'free_weight', 'structure', 'space', 'weighted', 'other']);
export type EquipmentCategory = z.infer<typeof EquipmentCategory>;

/** Grupos musculares normalizados usados por todo el catálogo y el mapa muscular. */
export const MuscleGroup = z.enum([
  'chest',
  'lats',
  'upper_back',
  'traps',
  'lower_back',
  'front_delts',
  'side_delts',
  'rear_delts',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'quads',
  'hamstrings',
  'glutes',
  'adductors',
  'abductors',
  'calves',
  'hip_flexors',
  'neck',
  'full_body',
]);
export type MuscleGroup = z.infer<typeof MuscleGroup>;

export const MUSCLE_LABELS_ES: Record<MuscleGroup, string> = {
  chest: 'Pecho',
  lats: 'Dorsales',
  upper_back: 'Espalda alta',
  traps: 'Trapecios',
  lower_back: 'Lumbares',
  front_delts: 'Deltoides anterior',
  side_delts: 'Deltoides lateral',
  rear_delts: 'Deltoides posterior',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearms: 'Antebrazos',
  abs: 'Abdomen',
  obliques: 'Oblicuos',
  quads: 'Cuádriceps',
  hamstrings: 'Isquiotibiales',
  glutes: 'Glúteos',
  adductors: 'Aductores',
  abductors: 'Abductores',
  calves: 'Pantorrillas',
  hip_flexors: 'Flexores de cadera',
  neck: 'Cuello',
  full_body: 'Cuerpo completo',
};

/** Patrones de movimiento para sustituciones (sección 5 del PRD). */
export const MovementPattern = z.enum([
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'squat',
  'hinge',
  'lunge',
  'core',
  'carry',
  'isolation',
  'skill',
  'mobility',
  'cardio',
  'explosive',
]);
export type MovementPattern = z.infer<typeof MovementPattern>;
