import { z } from 'zod';

/**
 * Salida esperada del LLM al generar una rutina (sección 6 del PRD).
 * El código decide estructura y límites; este esquema es la frontera de validación.
 */
export const RoutinePlan = z.object({
  rationale: z.string().max(600),
  days: z
    .array(
      z.object({
        name: z.string().max(40),
        exercises: z
          .array(
            z.object({
              exerciseId: z.string(),
              sets: z.number().int().min(1).max(6),
              repMin: z.number().int().min(1).max(30).nullable(),
              repMax: z.number().int().min(1).max(30).nullable(),
              targetSeconds: z.number().int().min(5).max(120).nullable(),
              rirTarget: z.number().int().min(0).max(4),
              restSeconds: z.number().int().min(30).max(300),
              notes: z.string().max(200).optional(),
            }),
          )
          .min(3)
          .max(9),
      }),
    )
    .min(2)
    .max(6),
});

export type RoutinePlan = z.infer<typeof RoutinePlan>;
export type RoutinePlanDay = RoutinePlan['days'][number];
export type RoutinePlanExercise = RoutinePlanDay['exercises'][number];
