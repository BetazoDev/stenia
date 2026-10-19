import type { LoadType, MuscleGroup } from '../schemas/common';
import { epley1rm, setLoad, setVolume } from './records';
import type { LoggedSet } from './types';

/** Comparaciones de la sección 9.1: serie vs. última vez, sesión vs. anterior, semana vs. semana. */

export type DeltaDirection = 'up' | 'same' | 'down';

export type SetDelta = {
  direction: DeltaDirection;
  weightKg: number | null;
  reps: number | null;
  seconds: number | null;
  assistanceKg: number | null;
};

function performance(s: LoggedSet, loadType: LoadType): number {
  switch (loadType) {
    case 'external':
    case 'weighted_bw': {
      const load = setLoad(s) ?? 0;
      const reps = s.reps ?? 0;
      return load > 0 ? (epley1rm(load, Math.min(reps, 12)) ?? load) * 1000 + reps : reps;
    }
    case 'assisted':
      // Menos asistencia es mejor; a igual asistencia, más repeticiones.
      return -(s.assistanceKg ?? 0) * 1000 + (s.reps ?? 0);
    case 'isometric':
      return s.seconds ?? 0;
    default:
      return s.reps ?? 0;
  }
}

const diff = (a: number | null, b: number | null) => (a !== null && b !== null ? Math.round((a - b) * 100) / 100 : null);

export function compareSet(current: LoggedSet, last: LoggedSet | null | undefined, loadType: LoadType): SetDelta | null {
  if (!last) return null;
  const a = performance(current, loadType);
  const b = performance(last, loadType);
  return {
    direction: a > b ? 'up' : a < b ? 'down' : 'same',
    weightKg: diff(setLoad(current), setLoad(last)),
    reps: diff(current.reps, last.reps),
    seconds: diff(current.seconds, last.seconds),
    assistanceKg: diff(current.assistanceKg, last.assistanceKg),
  };
}

export function totalVolume(sets: LoggedSet[]): number {
  return Math.round(sets.reduce((acc, s) => acc + (s.completed ? setVolume(s) : 0), 0) * 10) / 10;
}

export type SessionStats = {
  volumeKg: number;
  durationSec: number;
  avgRestSec: number | null;
  completedSets: number;
};

export function sessionStats(sets: (LoggedSet & { restActualSeconds?: number | null })[], durationSec: number): SessionStats {
  const done = sets.filter((s) => s.completed);
  const rests = done.map((s) => s.restActualSeconds).filter((v): v is number => typeof v === 'number' && v > 0);
  return {
    volumeKg: totalVolume(done),
    durationSec,
    avgRestSec: rests.length > 0 ? Math.round(rests.reduce((a, b) => a + b, 0) / rests.length) : null,
    completedSets: done.length,
  };
}

export type SessionComparison = {
  volumeKg: number | null;
  durationSec: number | null;
  avgRestSec: number | null;
};

export function compareSessions(current: SessionStats, previous: SessionStats | null): SessionComparison | null {
  if (!previous) return null;
  return {
    volumeKg: diff(current.volumeKg, previous.volumeKg),
    durationSec: diff(current.durationSec, previous.durationSec),
    avgRestSec: diff(current.avgRestSec, previous.avgRestSec),
  };
}

/** Serie efectiva: completa y con RIR ≤ 4 (o sin RIR registrado). */
export function isEffectiveSet(s: LoggedSet): boolean {
  return s.completed && (s.rir === null || s.rir <= 4);
}

export type MuscleSets = Partial<Record<MuscleGroup, number>>;

/** Series efectivas por grupo (primario 1, secundario 0.5) para el mapa muscular y semana vs. semana. */
export function effectiveSetsByMuscle(
  entries: { set: LoggedSet; primary: MuscleGroup[]; secondary: MuscleGroup[] }[],
): MuscleSets {
  const out: MuscleSets = {};
  for (const { set, primary, secondary } of entries) {
    if (!isEffectiveSet(set)) continue;
    for (const m of primary) out[m] = (out[m] ?? 0) + 1;
    for (const m of secondary) out[m] = (out[m] ?? 0) + 0.5;
  }
  return out;
}

/** Adherencia semanal: sesiones completadas / planeadas, acotada a 0–1. */
export function adherence(completed: number, planned: number): number {
  if (planned <= 0) return 0;
  return Math.min(1, Math.max(0, completed / planned));
}
