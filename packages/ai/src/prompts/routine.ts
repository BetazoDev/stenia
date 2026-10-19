import { z } from 'zod';

import { asUserData, DATA_RULE, type PromptDefinition } from './base';

/** Salida del LLM con códigos cortos (E1…En) en lugar de IDs largos; el servidor los traduce y valida. */
export const AliasRoutinePlan = z.object({
  rationale: z.string().max(600),
  days: z
    .array(
      z.object({
        name: z.string().max(40),
        exercises: z
          .array(
            z.object({
              exerciseId: z.string().describe('Código del catálogo, p. ej. E12'),
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
export type AliasRoutinePlan = z.infer<typeof AliasRoutinePlan>;

export type RoutinePromptInput = {
  profile: {
    age: number;
    sex: string;
    heightCm: number;
    weightKg: number;
    level: string;
    goal: string;
    gymRatio: number;
    skillGoals: string[];
    intensityCap: string;
    minRir: number;
    trainingMonths: number | null;
    marks: Record<string, number | null>;
  };
  split: { label: string; days: { name: string; focus: string }[] };
  minutesPerSession: number;
  repRules: string;
  restRules: string;
  volumeRules: string;
  injuries: string[];
  painfulMovements: string;
  favorites: string;
  banned: string;
  history: string | null;
  /** Una línea por ejercicio: "E12 | nombre | patrón | músculos | tipo de carga | nivel". */
  catalogLines: string[];
  previousErrors: string[];
};

export const routinePrompt: PromptDefinition<RoutinePromptInput> = {
  id: 'routine_generation',
  version: 1,
  render: (input) => ({
    system: [
      'Eres un entrenador de fuerza y calistenia. Armas rutinas seguras y eficaces en español de México.',
      'El código ya decidió la estructura (split, número de días, rangos, descansos, límites). Tú solo eliges',
      'ejercicios del catálogo permitido y ajustas series dentro de las reglas. Nunca inventes ejercicios: usa',
      'exclusivamente los códigos E… del catálogo. No des consejo médico. Responde solo con el JSON pedido.',
      DATA_RULE,
    ].join(' '),
    prompt: [
      '## Perfil (sin datos identificables)',
      JSON.stringify(input.profile),
      '',
      `## Estructura obligatoria: ${input.split.label}`,
      ...input.split.days.map((d, i) => `- Día ${i + 1}: «${d.name}» → ${d.focus}`),
      `- Cada sesión debe durar como máximo ${input.minutesPerSession} min (incluye 5 min de calentamiento). Entre 3 y 9 ejercicios.`,
      '',
      '## Reglas',
      `- Repeticiones: ${input.repRules}`,
      `- Descansos: ${input.restRules}`,
      `- Volumen: ${input.volumeRules}`,
      `- RIR mínimo por cribado de salud: ${input.profile.minRir}. Nunca pidas un RIR menor.`,
      '- Ejercicios isométricos (tipo de carga isometric): usa targetSeconds y deja repMin/repMax en null.',
      '- Resto de ejercicios: repMin y repMax obligatorios, targetSeconds en null.',
      '- Compuestos primero, accesorios después. No repitas un ejercicio en el mismo día.',
      '- Respeta la proporción gimnasio/calistenia del perfil al elegir.',
      '',
      '## Lesiones y preferencias',
      input.injuries.length > 0 ? `Zonas lesionadas (ya filtradas del catálogo): ${input.injuries.join(', ')}` : 'Sin lesiones declaradas.',
      input.painfulMovements ? asUserData('movimientos_que_duelen', input.painfulMovements) : '',
      input.favorites ? asUserData('ejercicios_favoritos', input.favorites) : '',
      input.banned ? asUserData('ejercicios_vetados', input.banned) : '',
      input.history ? `## Historial reciente\n${input.history}` : '',
      '',
      '## Catálogo permitido (código | nombre | patrón | músculos | tipo de carga | nivel)',
      ...input.catalogLines,
      '',
      input.previousErrors.length > 0
        ? `## Tu intento anterior falló la validación. Corrige exactamente esto:\n${input.previousErrors.map((e) => `- ${e}`).join('\n')}`
        : '',
      '',
      'Devuelve la rutina con una justificación breve (máximo 600 caracteres) en "rationale".',
    ]
      .filter((l) => l !== '')
      .join('\n'),
  }),
};
