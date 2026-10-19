import type { AiTask } from './settings';

/** Funciones que llaman al LLM, con su modelo y si son esenciales para el presupuesto (100% bloquea las demás). */
export const AI_FUNCTIONS = {
  connection_test: { task: 'fast', essential: true, label: 'Prueba de conexión' },
  routine_generation: { task: 'planning', essential: true, label: 'Generación de rutina' },
  checkin_summary: { task: 'planning', essential: true, label: 'Resumen de revisión' },
  meal_plan: { task: 'planning', essential: true, label: 'Plan de comidas' },
  exercise_tip: { task: 'fast', essential: false, label: 'Recomendación de ejercicio' },
  translation: { task: 'fast', essential: false, label: 'Traducción del catálogo' },
  inbody_extraction: { task: 'vision', essential: false, label: 'Lectura de ticket InBody' },
  body_fat_photo: { task: 'vision', essential: false, label: '% grasa por foto (experimental)' },
} as const satisfies Record<string, { task: AiTask; essential: boolean; label: string }>;

export type AiFunction = keyof typeof AI_FUNCTIONS;
