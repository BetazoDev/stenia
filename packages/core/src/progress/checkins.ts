import { z } from 'zod';

import type { RoutinePlan } from '../schemas/routine';
import type { MuscleGroup } from '../schemas/common';
import type { CatalogExercise } from '../routine/types';

/** Revisiones periódicas (sección 9.3): calendario y propuestas deterministas cuando no hay IA. */

export type CheckinMode = 'auto' | 'weekly' | 'biweekly' | 'monthly';
export type CheckinType = 'light' | 'full' | 'early';

export const CHECKIN_MODE_LABELS_ES: Record<CheckinMode, string> = {
  auto: 'Automática (recomendada)',
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
};

export const CHECKIN_TYPE_LABELS_ES: Record<CheckinType, string> = {
  light: 'Revisión ligera',
  full: 'Revisión completa',
  early: 'Revisión adelantada',
};

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Próximas fechas de revisión a partir de la última completada (o del inicio). */
export function nextCheckinDates(mode: CheckinMode, lastLight: string | null, lastFull: string | null, today: string): { light: string | null; full: string } {
  switch (mode) {
    case 'weekly':
      return { light: null, full: addDays(lastFull ?? today, lastFull ? 7 : 7) };
    case 'biweekly':
      return { light: null, full: addDays(lastFull ?? today, 14) };
    case 'monthly':
      return { light: null, full: addDays(lastFull ?? today, 28) };
    default:
      return { light: addDays(lastLight ?? today, 7), full: addDays(lastFull ?? today, 28) };
  }
}

export type Adjustment = {
  kind: 'volume' | 'deload' | 'swap_exercise' | 'rest' | 'calories' | 'keep';
  description: string;
  muscle: string | null;
  setsDelta: number | null;
  fromExercise: string | null;
  toExercise: string | null;
  kcalDelta: number | null;
};

export type ProposalInput = {
  triggers: string[];
  type: CheckinType;
  goal: string;
  adherencePct: number;
  avgEffort: number | null;
  energy: number | null;
  sleep: number | null;
  weightSlopePctPerWeek: number | null;
  expectedRange: { min: number; max: number } | null;
  stagnantExercises: { id: string; name: string; alternativeId: string | null; alternativeName: string | null }[];
  painExercises: { id: string; name: string; alternativeId: string | null; alternativeName: string | null }[];
};

const adj = (a: Partial<Adjustment> & Pick<Adjustment, 'kind' | 'description'>): Adjustment => ({
  muscle: null,
  setsDelta: null,
  fromExercise: null,
  toExercise: null,
  kcalDelta: null,
  ...a,
});

/** Propuestas basadas en reglas: misma forma que la salida del LLM, para aceptar, editar o rechazar. */
export function deterministicProposals(input: ProposalInput): { summary: string; adjustments: Adjustment[] } {
  const out: Adjustment[] = [];
  const lines: string[] = [];
  const tired = (input.avgEffort ?? 0) >= 8 || (input.energy !== null && input.energy <= 2) || (input.sleep !== null && input.sleep <= 2);

  if (input.triggers.includes('pain') || input.painExercises.length > 0) {
    for (const p of input.painExercises.slice(0, 2)) {
      if (p.alternativeId) {
        out.push(adj({ kind: 'swap_exercise', description: `Cambiar «${p.name}» por «${p.alternativeName}» mientras el dolor no ceda.`, fromExercise: p.id, toExercise: p.alternativeId }));
      }
    }
    lines.push('Reportaste dolor: conviene sustituir el ejercicio implicado y vigilar si persiste.');
  }
  if (input.triggers.includes('fatigue') || tired) {
    out.push(adj({ kind: 'deload', description: 'Semana de descarga: −10% de carga y una serie menos por ejercicio durante 7 días.' }));
    lines.push('Las señales de fatiga (esfuerzo alto, energía o sueño bajos) sugieren descargar una semana.');
  }
  if (input.stagnantExercises.length > 0 && !tired) {
    for (const s of input.stagnantExercises.slice(0, 2)) {
      if (s.alternativeId) {
        out.push(adj({ kind: 'swap_exercise', description: `«${s.name}» lleva 3 semanas sin progreso: rotarlo por «${s.alternativeName}».`, fromExercise: s.id, toExercise: s.alternativeId }));
      }
    }
    lines.push('Hay estancamiento en ejercicios principales; rotar la variante suele reactivar la progresión.');
  }
  if (input.adherencePct < 0.6) {
    out.push(adj({ kind: 'volume', description: 'Recortar una serie en los accesorios para que las sesiones quepan en tu semana.', muscle: 'accessories', setsDelta: -1 }));
    lines.push(`La adherencia fue de ${Math.round(input.adherencePct * 100)}%; una rutina más corta es más fácil de sostener.`);
  }
  if (input.weightSlopePctPerWeek !== null && input.expectedRange) {
    if (input.weightSlopePctPerWeek < input.expectedRange.min - 0.15) {
      out.push(adj({ kind: 'calories', description: 'El peso baja más rápido de lo previsto: +150 kcal diarias.', kcalDelta: 150 }));
      lines.push('El peso baja más rápido de lo esperado para tu objetivo.');
    } else if (input.weightSlopePctPerWeek > input.expectedRange.max + 0.15) {
      out.push(adj({ kind: 'calories', description: 'El peso sube más de lo previsto: −150 kcal diarias.', kcalDelta: -150 }));
      lines.push('El peso sube más de lo esperado para tu objetivo.');
    }
  }
  if (out.length === 0) {
    out.push(adj({ kind: 'keep', description: 'Mantener el plan: vas en rango.' }));
    lines.push('Todo va en rango: adherencia, tendencia de peso y progreso.');
  }
  return { summary: lines.join(' '), adjustments: out.slice(0, 5) };
}

/** Aplica ajustes aceptados a la rutina vigente y devuelve el plan de la nueva versión. */
export function applyAdjustments(plan: RoutinePlan, adjustments: Adjustment[], byId: Map<string, CatalogExercise>): RoutinePlan {
  const next: RoutinePlan = structuredClone(plan);
  for (const a of adjustments) {
    if (a.kind === 'swap_exercise' && a.fromExercise && a.toExercise && byId.has(a.toExercise)) {
      const target = byId.get(a.toExercise) as CatalogExercise;
      for (const day of next.days) {
        for (const e of day.exercises) {
          if (e.exerciseId !== a.fromExercise || day.exercises.some((x) => x.exerciseId === a.toExercise)) continue;
          e.exerciseId = a.toExercise;
          if (target.loadType === 'isometric') {
            e.targetSeconds = e.targetSeconds ?? 30;
            e.repMin = null;
            e.repMax = null;
          } else {
            e.repMin = e.repMin ?? 8;
            e.repMax = e.repMax ?? 12;
            e.targetSeconds = null;
          }
        }
      }
    }
    if (a.kind === 'volume' && a.setsDelta) {
      for (const day of next.days) {
        day.exercises.forEach((e, i) => {
          const ex = byId.get(e.exerciseId);
          const matches =
            a.muscle === 'accessories'
              ? i >= 2
              : a.muscle
                ? (ex?.primaryMuscles as string[] | undefined)?.includes(a.muscle as MuscleGroup)
                : false;
          if (matches) e.sets = Math.min(6, Math.max(1, e.sets + (a.setsDelta ?? 0)));
        });
      }
    }
    if (a.kind === 'rest') {
      for (const day of next.days) for (const e of day.exercises) e.restSeconds = Math.min(300, e.restSeconds + 15);
    }
  }
  next.rationale = `Ajustes de revisión: ${adjustments.filter((a) => a.kind !== 'keep' && a.kind !== 'calories' && a.kind !== 'deload').map((a) => a.description).join(' ')}`.slice(0, 600);
  return next;
}

/** ¿Algún ajuste cambia la rutina (y por tanto requiere una nueva versión)? */
export function changesRoutine(adjustments: Adjustment[]): boolean {
  return adjustments.some((a) => a.kind === 'swap_exercise' || a.kind === 'volume' || a.kind === 'rest');
}

/** Respuestas del formulario de revisión (validadas en el servidor). Escalas 1–5. */
export const MissedReason = z.enum(['time', 'motivation', 'illness', 'travel', 'pain', 'other']);
export type MissedReason = z.infer<typeof MissedReason>;

export const MISSED_REASON_LABELS_ES: Record<MissedReason, string> = {
  time: 'Falta de tiempo',
  motivation: 'Motivación',
  illness: 'Enfermedad',
  travel: 'Viaje',
  pain: 'Dolor o molestia',
  other: 'Otra razón',
};

const scale = z.coerce.number().int().min(1).max(5);
const optionalCm = z.coerce.number().min(10).max(250).nullable().default(null);

export const CheckinAnswers = z.object({
  weightKg: z.coerce.number().min(25).max(350).nullable().default(null),
  energy: scale,
  sleep: scale,
  effort: scale,
  planRating: scale.nullable().default(null),
  painPersists: z.boolean().nullable().default(null),
  missedReason: MissedReason.nullable().default(null),
  notes: z.string().max(1000).default(''),
  measurements: z
    .object({ neckCm: optionalCm, waistCm: optionalCm, hipCm: optionalCm, armCm: optionalCm, thighCm: optionalCm })
    .nullable()
    .default(null),
});
export type CheckinAnswers = z.infer<typeof CheckinAnswers>;

export const ADJUSTMENT_KIND_LABELS_ES: Record<Adjustment['kind'], string> = {
  volume: 'Volumen',
  deload: 'Descarga',
  swap_exercise: 'Cambio de ejercicio',
  rest: 'Descansos',
  calories: 'Calorías',
  keep: 'Mantener',
};
