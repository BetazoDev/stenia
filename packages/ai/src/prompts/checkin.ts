import { z } from 'zod';

import { asUserData, DATA_RULE, type PromptDefinition } from './base';

export const CheckinAdjustment = z.object({
  kind: z.enum(['volume', 'deload', 'swap_exercise', 'rest', 'calories', 'keep']),
  /** Descripción breve en español (se muestra al usuario para aceptar, editar o rechazar). */
  description: z.string().max(240),
  /** Para volume: grupo muscular y cambio de series semanales (−4 a +4). */
  muscle: z.string().nullable().default(null),
  setsDelta: z.number().int().min(-4).max(4).nullable().default(null),
  /** Para swap_exercise: código E… del ejercicio actual y del sustituto. */
  fromExercise: z.string().nullable().default(null),
  toExercise: z.string().nullable().default(null),
  /** Para calories: cambio diario de kcal (−300 a +300). */
  kcalDelta: z.number().int().min(-300).max(300).nullable().default(null),
});
export type CheckinAdjustment = z.infer<typeof CheckinAdjustment>;

export const CheckinAnalysis = z.object({
  summary: z.string().max(900),
  adjustments: z.array(CheckinAdjustment).max(5),
});
export type CheckinAnalysis = z.infer<typeof CheckinAnalysis>;

export type CheckinPromptInput = {
  type: string;
  trigger: string | null;
  goal: string;
  metrics: Record<string, unknown>;
  answers: Record<string, unknown>;
  notes: string;
  rules: string;
  exerciseLines: string[];
};

export const checkinPrompt: PromptDefinition<CheckinPromptInput> = {
  id: 'checkin_summary',
  version: 1,
  render: (input) => ({
    system: [
      'Eres un entrenador que revisa el progreso con datos. Escribe en español de México, claro y breve.',
      'Describe tendencias y opciones; nunca diagnostiques condiciones médicas. Nunca decidas con un solo pesaje.',
      'Propón como máximo 5 ajustes dentro de las reglas; si no hace falta cambiar nada, propone "keep".',
      DATA_RULE,
    ].join(' '),
    prompt: [
      `Revisión: ${input.type}${input.trigger ? ` (disparador: ${input.trigger})` : ''}. Objetivo: ${input.goal}.`,
      '## Métricas calculadas por el código',
      JSON.stringify(input.metrics),
      '## Respuestas de la revisión',
      JSON.stringify(input.answers),
      input.notes ? asUserData('notas', input.notes) : '',
      '## Reglas para los ajustes',
      input.rules,
      '## Ejercicios de la rutina actual (código | nombre | patrón)',
      ...input.exerciseLines,
    ]
      .filter(Boolean)
      .join('\n'),
  }),
};
