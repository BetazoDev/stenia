import type { LoggedSet } from './types';

/** Récords automáticos (sección 9.1 del PRD). */

export type RecordType = 'max_weight' | 'max_reps_at_weight' | 'max_e1rm' | 'max_volume' | 'longest_isometric' | 'new_variant';

export const RECORD_LABELS_ES: Record<RecordType, string> = {
  max_weight: 'Mayor peso',
  max_reps_at_weight: 'Más repeticiones con ese peso',
  max_e1rm: 'Mayor 1RM estimado',
  max_volume: 'Mayor volumen en una sesión',
  longest_isometric: 'Isométrico más largo',
  new_variant: 'Nueva variante desbloqueada',
};

/** 1RM estimado con Epley, solo válido hasta 12 repeticiones. */
export function epley1rm(weightKg: number, reps: number): number | null {
  if (weightKg <= 0 || reps <= 0 || reps > 12) return null;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

/** Carga efectiva de una serie: peso externo o lastre sobre peso corporal. */
export function setLoad(s: Pick<LoggedSet, 'weightKg' | 'addedWeightKg'>): number | null {
  if (typeof s.weightKg === 'number' && s.weightKg > 0) return s.weightKg;
  if (typeof s.addedWeightKg === 'number' && s.addedWeightKg > 0) return s.addedWeightKg;
  return null;
}

export function setVolume(s: LoggedSet): number {
  const load = setLoad(s);
  return load !== null && s.reps ? load * s.reps : 0;
}

export function bestSet(sets: LoggedSet[]): LoggedSet | null {
  const done = sets.filter((s) => s.completed);
  if (done.length === 0) return null;
  return [...done].sort((a, b) => {
    const ea = epley1rm(setLoad(a) ?? 0, a.reps ?? 0) ?? 0;
    const eb = epley1rm(setLoad(b) ?? 0, b.reps ?? 0) ?? 0;
    return eb - ea || (setLoad(b) ?? 0) - (setLoad(a) ?? 0) || (b.reps ?? 0) - (a.reps ?? 0) || (b.seconds ?? 0) - (a.seconds ?? 0);
  })[0] ?? null;
}

export type DetectedRecord = { type: RecordType; value: number };

/** Récords que establece una serie frente a todo el historial previo del ejercicio. */
export function detectSetRecords(set: LoggedSet, history: LoggedSet[]): DetectedRecord[] {
  if (!set.completed) return [];
  const prev = history.filter((s) => s.completed);
  const out: DetectedRecord[] = [];
  const load = setLoad(set);
  if (load !== null) {
    const maxPrev = Math.max(0, ...prev.map((s) => setLoad(s) ?? 0));
    if (prev.length > 0 && load > maxPrev) out.push({ type: 'max_weight', value: load });
    const sameLoad = prev.filter((s) => setLoad(s) === load);
    if (sameLoad.length > 0 && (set.reps ?? 0) > Math.max(...sameLoad.map((s) => s.reps ?? 0))) {
      out.push({ type: 'max_reps_at_weight', value: set.reps ?? 0 });
    }
    const e1 = epley1rm(load, set.reps ?? 0);
    const prevE1 = Math.max(0, ...prev.map((s) => epley1rm(setLoad(s) ?? 0, s.reps ?? 0) ?? 0));
    if (e1 !== null && prev.length > 0 && e1 > prevE1) out.push({ type: 'max_e1rm', value: e1 });
  }
  if (typeof set.seconds === 'number' && set.seconds > 0) {
    const prevSec = Math.max(0, ...prev.map((s) => s.seconds ?? 0));
    if (prev.length > 0 && set.seconds > prevSec) out.push({ type: 'longest_isometric', value: set.seconds });
  }
  return out;
}

export function detectVolumeRecord(sessionSets: LoggedSet[], previousSessions: LoggedSet[][]): DetectedRecord | null {
  const vol = sessionSets.reduce((acc, s) => acc + (s.completed ? setVolume(s) : 0), 0);
  if (vol <= 0 || previousSessions.length === 0) return null;
  const prevMax = Math.max(...previousSessions.map((sets) => sets.reduce((acc, s) => acc + (s.completed ? setVolume(s) : 0), 0)));
  return vol > prevMax ? { type: 'max_volume', value: Math.round(vol * 10) / 10 } : null;
}
