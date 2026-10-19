'use client';

import type { SessionSummary } from '@stenia/db';

import { localDb, type LocalExercise, type LocalSession, type LocalSet } from './local-db';

let inFlight: Promise<SyncOutcome> | null = null;

export type SyncOutcome = { ok: boolean; pending: number; summaries: Record<string, SessionSummary> };

const sessionPayload = (s: LocalSession) => ({
  id: s.id,
  routineVersionId: s.routineVersionId,
  routineDayId: s.routineDayId,
  gymProfileId: s.gymProfileId,
  status: s.status,
  startedAt: s.startedAt,
  endedAt: s.endedAt,
  pausedMs: s.pausedMs,
  pausedAt: s.pausedAt,
  effort: s.effort,
  notes: s.notes,
  updatedAt: s.updatedAt,
});

const exercisePayload = (e: LocalExercise) => ({
  id: e.id,
  sessionId: e.sessionId,
  routineExerciseId: e.routineExerciseId,
  exerciseId: e.exerciseId,
  sortOrder: e.sortOrder,
  startedAt: e.startedAt,
  endedAt: e.endedAt,
  substitutedFromExerciseId: e.substitutedFromExerciseId,
  notes: e.notes,
  updatedAt: e.updatedAt,
});

const setPayload = (s: LocalSet) => ({
  id: s.id,
  sessionExerciseId: s.sessionExerciseId,
  sessionId: s.sessionId,
  setNumber: s.setNumber,
  weightKg: s.weightKg,
  assistanceKg: s.assistanceKg,
  addedWeightKg: s.addedWeightKg,
  reps: s.reps,
  seconds: s.seconds,
  rir: s.rir,
  target: s.target,
  startedAt: s.startedAt,
  completedAt: s.completedAt,
  restActualSeconds: s.restActualSeconds,
  restTargetSeconds: s.restTargetSeconds,
  pain: s.pain,
  notes: s.notes,
  updatedAt: s.updatedAt,
});

/** Envía la cola local al servidor. Idempotente: los IDs vienen del cliente y el servidor resuelve por marca de tiempo. */
export function flushOutbox(): Promise<SyncOutcome> {
  if (inFlight) return inFlight;
  inFlight = (async (): Promise<SyncOutcome> => {
    const db = localDb();
    const entries = await db.outbox.orderBy('seq').limit(500).toArray();
    if (entries.length === 0) return { ok: true, pending: 0, summaries: {} };
    if (typeof navigator !== 'undefined' && !navigator.onLine) return { ok: false, pending: entries.length, summaries: {} };
    const maxSeq = Math.max(...entries.map((e) => e.seq ?? 0));
    const ids = (entity: string) => [...new Set(entries.filter((e) => e.entity === entity).map((e) => e.entityId))];
    const sessionIds = new Set(ids('session'));
    const exercises = (await db.exercises.bulkGet(ids('exercise'))).filter((x): x is LocalExercise => Boolean(x));
    const sets = (await db.sets.bulkGet(ids('set'))).filter((x): x is LocalSet => Boolean(x));
    // El servidor necesita la sesión para aceptar ejercicios y series nuevos.
    for (const e of exercises) sessionIds.add(e.sessionId);
    for (const s of sets) sessionIds.add(s.sessionId);
    const sessions = (await db.sessions.bulkGet([...sessionIds])).filter((x): x is LocalSession => Boolean(x));
    const exerciseIds = new Set(exercises.map((e) => e.id));
    for (const s of sets) {
      if (!exerciseIds.has(s.sessionExerciseId)) {
        const ex = await db.exercises.get(s.sessionExerciseId);
        if (ex) {
          exercises.push(ex);
          exerciseIds.add(ex.id);
        }
      }
    }
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessions: sessions.map(sessionPayload), exercises: exercises.map(exercisePayload), sets: sets.map(setPayload) }),
      });
      if (!response.ok) return { ok: false, pending: entries.length, summaries: {} };
      const data = (await response.json()) as { ok: boolean; summaries: Record<string, SessionSummary> };
      await db.outbox.where('seq').belowOrEqual(maxSeq).delete();
      for (const [id, summary] of Object.entries(data.summaries ?? {})) {
        await db.sessions.update(id, { summary });
      }
      const rest = await db.outbox.count();
      return { ok: true, pending: rest, summaries: data.summaries ?? {} };
    } catch {
      return { ok: false, pending: entries.length, summaries: {} };
    }
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

let listening = false;

/** Sincroniza al recuperar la conexión y al volver a la app. */
export function startBackgroundSync() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  const run = () => void flushOutbox();
  window.addEventListener('online', run);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') run();
  });
  window.setInterval(run, 30_000);
  run();
}
