import type { ExerciseSession, LoggedSet, Prescribed } from './types';

/**
 * Motor de progresión determinista (sección 6.1 del PRD). Recibe el historial más reciente primero y
 * devuelve la meta de hoy con la razón en una línea.
 */

export type ProgressionAction =
  | 'start'
  | 'increase'
  | 'hold'
  | 'deload'
  | 'advance_variant'
  | 'regress_variant'
  | 'decrease_assistance'
  | 'increase_assistance'
  | 'add_weight'
  | 'add_seconds';

export type Ladder = {
  previousId: string | null;
  nextId: string | null;
  /** Umbral para pasar a la siguiente variante (por defecto: repMax en 3 sesiones). */
  threshold?: { kind: 'reps' | 'seconds'; value: number; sessions: number } | null;
};

export type Increments = {
  /** Incremento mínimo del equipo (kg). */
  loadKg: number;
  /** Paso de asistencia (banda o contrapeso, kg). */
  assistanceKg: number;
  /** Paso mínimo de lastre disponible (kg); 0 si no hay lastre. */
  addedKg: number;
};

export type ProgressionInput = {
  prescription: Prescribed;
  history: ExerciseSession[];
  increments?: Partial<Increments>;
  ladder?: Ladder | null;
  /** Semana de descarga activa (cada 4–8 semanas o por revisión). */
  deload?: boolean;
  /** Peso inicial estimado del cuestionario para la primera sesión. */
  initialWeightKg?: number | null;
};

export type TodayTarget = {
  action: ProgressionAction;
  weightKg: number | null;
  assistanceKg: number | null;
  addedWeightKg: number | null;
  repMin: number | null;
  repMax: number | null;
  targetSeconds: number | null;
  rirMin: number;
  rirMax: number;
  /** Cambio de variante sugerido (bodyweight, assisted, isometric). */
  suggestedExerciseId: string | null;
  reason: string;
};

export const DEFAULT_INCREMENTS: Increments = { loadKg: 2.5, assistanceKg: 5, addedKg: 2.5 };
export const DELOAD_FACTOR = 0.9;
const SECONDS_STEP = 5;
const MAX_SECONDS = 120;

export function roundToStep(value: number, step: number): number {
  if (step <= 0) return Math.round(value * 100) / 100;
  return Math.round(Math.round(value / step) * step * 100) / 100;
}

function fmt(n: number): string {
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(n);
}

const completedSets = (s: ExerciseSession) => s.sets.filter((x) => x.completed);

/** Peso de trabajo de una sesión: el más usado entre las series completas (o el máximo si empatan). */
export function workingValue(sets: LoggedSet[], key: 'weightKg' | 'assistanceKg' | 'addedWeightKg'): number | null {
  const values = sets.map((s) => s[key]).filter((v): v is number => typeof v === 'number');
  if (values.length === 0) return null;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? null;
}

function targetSecondsOf(session: ExerciseSession, fallback: number | null): number | null {
  const fromTarget = session.sets.map((s) => s.target?.seconds).find((v): v is number => typeof v === 'number');
  return fromTarget ?? fallback;
}

/** Todas las series previstas, completas y en el tope del rango con RIR ≥ 1 (doble progresión). */
export function hitTopOfRange(session: ExerciseSession, p: Prescribed): boolean {
  const done = completedSets(session);
  if (done.length < p.sets || p.repMax === null) return false;
  return done.every((s) => (s.reps ?? 0) >= (p.repMax ?? 0) && (s.rir === null || s.rir >= 1));
}

/** Sesión fallida: faltaron series o alguna quedó por debajo del mínimo. */
export function failedSession(session: ExerciseSession, p: Prescribed): boolean {
  const done = completedSets(session);
  if (done.length < p.sets) return true;
  if (p.loadType === 'isometric') {
    const target = targetSecondsOf(session, p.targetSeconds) ?? 0;
    return done.some((s) => (s.seconds ?? 0) < target);
  }
  return p.repMin !== null && done.some((s) => (s.reps ?? 0) < (p.repMin ?? 0));
}

function meetsThreshold(session: ExerciseSession, p: Prescribed, threshold: { kind: 'reps' | 'seconds'; value: number }): boolean {
  const done = completedSets(session);
  if (done.length < p.sets) return false;
  return done.every((s) => (threshold.kind === 'reps' ? (s.reps ?? 0) : (s.seconds ?? 0)) >= threshold.value);
}

function countConsecutive(history: ExerciseSession[], predicate: (s: ExerciseSession) => boolean): number {
  let n = 0;
  for (const s of history) {
    if (!predicate(s)) break;
    n += 1;
  }
  return n;
}

export function computeTodayTarget(input: ProgressionInput): TodayTarget {
  const p = input.prescription;
  const inc: Increments = { ...DEFAULT_INCREMENTS, ...input.increments };
  const history = input.history.filter((s) => completedSets(s).length > 0);
  const last = history[0];
  const base: TodayTarget = {
    action: 'hold',
    weightKg: null,
    assistanceKg: null,
    addedWeightKg: null,
    repMin: p.repMin,
    repMax: p.repMax,
    targetSeconds: p.targetSeconds,
    rirMin: p.rirTarget,
    rirMax: Math.min(4, p.rirTarget + 1),
    suggestedExerciseId: null,
    reason: '',
  };

  if (!last) {
    if (p.loadType === 'external' || p.loadType === 'weighted_bw') {
      const w = input.initialWeightKg ? roundToStep(input.initialWeightKg, inc.loadKg) : null;
      return {
        ...base,
        action: 'start',
        weightKg: p.loadType === 'external' ? w : null,
        addedWeightKg: p.loadType === 'weighted_bw' ? 0 : null,
        reason: w
          ? `Primera vez: arranca con ${fmt(w)} kg y ajusta para dejar ${p.rirTarget}–${base.rirMax} repeticiones en reserva.`
          : `Primera vez: elige un peso que te deje ${p.rirTarget}–${base.rirMax} repeticiones en reserva.`,
      };
    }
    return {
      ...base,
      action: 'start',
      reason:
        p.loadType === 'isometric'
          ? `Primera vez: sostén ${p.targetSeconds ?? 20} s con buena técnica.`
          : 'Primera vez: busca el rango con técnica limpia.',
    };
  }

  const fails = countConsecutive(history, (s) => failedSession(s, p));

  switch (p.loadType) {
    case 'external':
    case 'weighted_bw': {
      const key = p.loadType === 'external' ? 'weightKg' : 'addedWeightKg';
      const step = p.loadType === 'external' ? inc.loadKg : inc.addedKg || inc.loadKg;
      const current = workingValue(completedSets(last), key) ?? 0;
      const set = (value: number) => (p.loadType === 'external' ? { weightKg: value } : { addedWeightKg: value });
      if (input.deload) {
        const v = roundToStep(current * DELOAD_FACTOR, step);
        return { ...base, ...set(v), action: 'deload', reason: `Semana de descarga: bajas a ${fmt(v)} kg (−10%) para recuperar.` };
      }
      if (fails >= 3) {
        const v = roundToStep(current * DELOAD_FACTOR, step);
        return { ...base, ...set(v), action: 'deload', reason: `Tres sesiones por debajo del rango: bajas a ${fmt(v)} kg (−10%).` };
      }
      if (fails === 2) {
        return { ...base, ...set(current), action: 'hold', reason: `Dos sesiones por debajo del rango: mantén ${fmt(current)} kg.` };
      }
      if (hitTopOfRange(last, p)) {
        const v = roundToStep(current + step, step);
        return {
          ...base,
          ...set(v),
          action: p.loadType === 'external' ? 'increase' : 'add_weight',
          reason: `Subes ${fmt(step)} kg: completaste ${p.sets}×${p.repMax} la vez pasada.`,
        };
      }
      return {
        ...base,
        ...set(current),
        action: 'hold',
        reason: `Mantén ${fmt(current)} kg y suma repeticiones hasta ${p.repMax ?? '?'} en todas las series.`,
      };
    }

    case 'assisted': {
      const current = workingValue(completedSets(last), 'assistanceKg') ?? 0;
      if (hitTopOfRange(last, p)) {
        if (current <= inc.assistanceKg && input.ladder?.nextId) {
          return { ...base, assistanceKg: 0, action: 'advance_variant', suggestedExerciseId: input.ladder.nextId, reason: 'Ya casi sin ayuda: pasa a la versión sin asistencia.' };
        }
        const v = Math.max(0, roundToStep(current - inc.assistanceKg, inc.assistanceKg));
        return { ...base, assistanceKg: v, action: 'decrease_assistance', reason: `Llegaste al tope: bajas la asistencia a ${fmt(v)} kg.` };
      }
      if (fails >= 2) {
        const v = roundToStep(current + inc.assistanceKg, inc.assistanceKg);
        return { ...base, assistanceKg: v, action: 'increase_assistance', reason: `Dos sesiones por debajo del rango: subes la asistencia a ${fmt(v)} kg.` };
      }
      return { ...base, assistanceKg: current, action: 'hold', reason: `Mantén ${fmt(current)} kg de asistencia y suma repeticiones.` };
    }

    case 'bodyweight': {
      const threshold = input.ladder?.threshold ?? { kind: 'reps' as const, value: p.repMax ?? 12, sessions: 3 };
      const streak = countConsecutive(history, (s) => meetsThreshold(s, p, threshold));
      if (streak >= threshold.sessions) {
        if (input.ladder?.nextId) {
          return {
            ...base,
            action: 'advance_variant',
            suggestedExerciseId: input.ladder.nextId,
            reason: `${threshold.sessions} sesiones seguidas con ≥${threshold.value}: pasa a la siguiente variante.`,
          };
        }
        if (inc.addedKg > 0) {
          return { ...base, addedWeightKg: inc.addedKg, action: 'add_weight', reason: `Dominas la variante final: agrega ${fmt(inc.addedKg)} kg de lastre.` };
        }
      }
      if (fails >= 2 && input.ladder?.previousId) {
        return { ...base, action: 'regress_variant', suggestedExerciseId: input.ladder.previousId, reason: 'Dos sesiones por debajo del mínimo: vuelve a la variante anterior y consolida.' };
      }
      const best = Math.min(...completedSets(last).map((s) => s.reps ?? 0));
      return {
        ...base,
        action: 'hold',
        reason: `Suma repeticiones: la vez pasada tu serie más baja fue de ${best}; meta ${p.repMax ?? threshold.value}.`,
      };
    }

    case 'isometric': {
      const lastTarget = targetSecondsOf(last, p.targetSeconds) ?? p.targetSeconds ?? 20;
      const threshold = input.ladder?.threshold;
      if (!failedSession(last, p) && completedSets(last).every((s) => (s.seconds ?? 0) >= lastTarget)) {
        const next = Math.min(MAX_SECONDS, lastTarget + SECONDS_STEP);
        if (input.ladder?.nextId && threshold?.kind === 'seconds' && lastTarget >= threshold.value) {
          return {
            ...base,
            targetSeconds: p.targetSeconds,
            action: 'advance_variant',
            suggestedExerciseId: input.ladder.nextId,
            reason: `Sostienes ${lastTarget} s en todas las series: pasa a la siguiente variante.`,
          };
        }
        return { ...base, targetSeconds: next, action: 'add_seconds', reason: `Completaste ${lastTarget} s en todas las series: meta ${next} s.` };
      }
      if (fails >= 2) {
        if (input.ladder?.previousId) {
          return { ...base, targetSeconds: p.targetSeconds, action: 'regress_variant', suggestedExerciseId: input.ladder.previousId, reason: 'Dos sesiones sin llegar al tiempo: vuelve a la variante anterior.' };
        }
        const v = Math.max(5, lastTarget - SECONDS_STEP);
        return { ...base, targetSeconds: v, action: 'hold', reason: `Dos sesiones sin llegar al tiempo: meta ${v} s.` };
      }
      return { ...base, targetSeconds: lastTarget, action: 'hold', reason: `Repite ${lastTarget} s en todas las series.` };
    }
  }
}

/** "62.5 kg × 8–12, RIR 1–2" o "40 s, RIR 1–2" para la tarjeta "Hoy". */
export function formatTarget(t: TodayTarget, loadType: Prescribed['loadType']): string {
  const rir = `RIR ${t.rirMin}–${t.rirMax}`;
  const reps = t.repMin !== null && t.repMax !== null ? (t.repMin === t.repMax ? `${t.repMin}` : `${t.repMin}–${t.repMax}`) : '';
  if (loadType === 'isometric') return `${t.targetSeconds ?? '?'} s, ${rir}`;
  if (loadType === 'external') return `${t.weightKg !== null ? `${fmt(t.weightKg)} kg × ` : ''}${reps}, ${rir}`;
  if (loadType === 'weighted_bw') return `${t.addedWeightKg ? `+${fmt(t.addedWeightKg)} kg × ` : ''}${reps}, ${rir}`;
  if (loadType === 'assisted') return `${t.assistanceKg !== null ? `asistencia ${fmt(t.assistanceKg)} kg × ` : ''}${reps}, ${rir}`;
  return `${reps} reps, ${rir}`;
}

/** Semana de descarga cada `everyWeeks` semanas del bloque (4–8 según el PRD). */
export function isDeloadWeek(blockWeek: number, everyWeeks: number): boolean {
  const n = Math.min(8, Math.max(4, Math.round(everyWeeks)));
  return blockWeek > 0 && blockWeek % n === 0;
}
