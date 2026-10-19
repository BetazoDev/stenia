import 'server-only';

import {
  detectSetRecords,
  detectVolumeRecord,
  sessionElapsedMs,
  sessionStats,
  setVolume,
  type LoggedSet,
  type RecordType,
} from '@stenia/core';
import { exerciseProgression, personalRecord, sessionExercise, setLog, workoutSession, type SessionSummary } from '@stenia/db';
import { and, desc, eq, inArray, isNotNull, ne } from 'drizzle-orm';
import { z } from 'zod';

import { triggerEarlyCheckin } from './checkins-trigger';
import { getDb } from './db';

const ms = z.number().int().nonnegative();
const nullableMs = ms.nullable();
const kg = z.number().min(0).max(1000).nullable();

export const SyncSession = z.object({
  id: z.uuid(),
  routineVersionId: z.string().nullable(),
  routineDayId: z.string().nullable(),
  gymProfileId: z.string().nullable(),
  status: z.enum(['active', 'completed', 'discarded']),
  startedAt: ms,
  endedAt: nullableMs,
  pausedMs: ms,
  pausedAt: nullableMs,
  effort: z.number().int().min(1).max(10).nullable(),
  notes: z.string().max(2000).nullable(),
  updatedAt: ms,
});

export const SyncExercise = z.object({
  id: z.uuid(),
  sessionId: z.uuid(),
  routineExerciseId: z.string().nullable(),
  exerciseId: z.string().min(1),
  sortOrder: z.number().int().min(0).max(99),
  startedAt: nullableMs,
  endedAt: nullableMs,
  substitutedFromExerciseId: z.string().nullable(),
  notes: z.string().max(1000).nullable(),
  updatedAt: ms,
});

export const SyncSet = z.object({
  id: z.uuid(),
  sessionExerciseId: z.uuid(),
  sessionId: z.uuid(),
  setNumber: z.number().int().min(1).max(30),
  weightKg: kg,
  assistanceKg: kg,
  addedWeightKg: kg,
  reps: z.number().int().min(0).max(500).nullable(),
  seconds: z.number().int().min(0).max(3600).nullable(),
  rir: z.number().int().min(0).max(10).nullable(),
  target: z.record(z.string(), z.number().nullable()).nullable(),
  startedAt: nullableMs,
  completedAt: nullableMs,
  restActualSeconds: z.number().int().min(0).max(7200).nullable(),
  restTargetSeconds: z.number().int().min(0).max(1200).nullable(),
  pain: z.boolean(),
  notes: z.string().max(500).nullable(),
  updatedAt: ms,
});

export const SyncPayload = z.object({
  sessions: z.array(SyncSession).max(20).default([]),
  exercises: z.array(SyncExercise).max(200).default([]),
  sets: z.array(SyncSet).max(1000).default([]),
});
export type SyncPayload = z.infer<typeof SyncPayload>;

export type SyncResult = { ok: true; summaries: Record<string, SessionSummary>; rejected: string[] };

const d = (v: number | null) => (v === null ? null : new Date(v));

/** Aplica cambios del cliente sin duplicados (IDs del cliente) con "gana la marca más reciente". */
export async function applySync(userId: string, payload: SyncPayload): Promise<SyncResult> {
  const db = getDb();
  const rejected: string[] = [];
  const completedNow: string[] = [];
  let painReported = false;

  await db.transaction(async (tx) => {
    const sessionIds = [...new Set([...payload.sessions.map((s) => s.id), ...payload.exercises.map((e) => e.sessionId), ...payload.sets.map((s) => s.sessionId)])];
    const existing = sessionIds.length
      ? await tx.select({ id: workoutSession.id, userId: workoutSession.userId, status: workoutSession.status, clientUpdatedAt: workoutSession.clientUpdatedAt, summary: workoutSession.summary }).from(workoutSession).where(inArray(workoutSession.id, sessionIds))
      : [];
    const owned = new Set(existing.filter((s) => s.userId === userId).map((s) => s.id));
    const foreign = new Set(existing.filter((s) => s.userId !== userId).map((s) => s.id));

    for (const s of payload.sessions) {
      if (foreign.has(s.id)) {
        rejected.push(s.id);
        continue;
      }
      const prev = existing.find((e) => e.id === s.id);
      if (prev?.clientUpdatedAt && prev.clientUpdatedAt.getTime() > s.updatedAt) continue;
      const values = {
        id: s.id,
        userId,
        routineVersionId: s.routineVersionId,
        routineDayId: s.routineDayId,
        gymProfileId: s.gymProfileId,
        status: s.status,
        startedAt: new Date(s.startedAt),
        endedAt: d(s.endedAt),
        pausedMs: s.pausedMs,
        pausedAt: d(s.pausedAt),
        effort: s.effort,
        notes: s.notes,
        clientUpdatedAt: new Date(s.updatedAt),
        updatedAt: new Date(),
      };
      await tx.insert(workoutSession).values(values).onConflictDoUpdate({ target: workoutSession.id, set: { ...values, id: undefined, userId: undefined } });
      owned.add(s.id);
      if (s.status === 'completed' && (!prev || prev.status !== 'completed' || !prev.summary)) completedNow.push(s.id);
    }

    const exerciseIds = [...new Set([...payload.exercises.map((e) => e.id), ...payload.sets.map((s) => s.sessionExerciseId)])];
    const existingEx = exerciseIds.length
      ? await tx.select({ id: sessionExercise.id, userId: sessionExercise.userId, clientUpdatedAt: sessionExercise.clientUpdatedAt }).from(sessionExercise).where(inArray(sessionExercise.id, exerciseIds))
      : [];
    const ownedEx = new Set(existingEx.filter((e) => e.userId === userId).map((e) => e.id));
    for (const e of payload.exercises) {
      const prev = existingEx.find((x) => x.id === e.id);
      if (!owned.has(e.sessionId) || (prev && prev.userId !== userId)) {
        rejected.push(e.id);
        continue;
      }
      if (prev?.clientUpdatedAt && prev.clientUpdatedAt.getTime() > e.updatedAt) continue;
      const values = {
        id: e.id,
        sessionId: e.sessionId,
        userId,
        routineExerciseId: e.routineExerciseId,
        exerciseId: e.exerciseId,
        sortOrder: e.sortOrder,
        startedAt: d(e.startedAt),
        endedAt: d(e.endedAt),
        substitutedFromExerciseId: e.substitutedFromExerciseId,
        notes: e.notes,
        clientUpdatedAt: new Date(e.updatedAt),
      };
      await tx.insert(sessionExercise).values(values).onConflictDoUpdate({ target: sessionExercise.id, set: { ...values, id: undefined, userId: undefined } });
      ownedEx.add(e.id);
    }

    const setIds = payload.sets.map((s) => s.id);
    const existingSets = setIds.length
      ? await tx.select({ id: setLog.id, userId: setLog.userId, clientUpdatedAt: setLog.clientUpdatedAt }).from(setLog).where(inArray(setLog.id, setIds))
      : [];
    for (const s of payload.sets) {
      const prev = existingSets.find((x) => x.id === s.id);
      if (!ownedEx.has(s.sessionExerciseId) || (prev && prev.userId !== userId)) {
        rejected.push(s.id);
        continue;
      }
      if (prev?.clientUpdatedAt && prev.clientUpdatedAt.getTime() > s.updatedAt) continue;
      if (s.completedAt === null) {
        if (prev) await tx.delete(setLog).where(and(eq(setLog.id, s.id), eq(setLog.userId, userId)));
        continue;
      }
      if (s.pain) painReported = true;
      const values = {
        id: s.id,
        sessionExerciseId: s.sessionExerciseId,
        userId,
        setNumber: s.setNumber,
        weightKg: s.weightKg,
        assistanceKg: s.assistanceKg,
        addedWeightKg: s.addedWeightKg,
        reps: s.reps,
        seconds: s.seconds,
        rir: s.rir,
        target: s.target,
        startedAt: d(s.startedAt),
        completedAt: d(s.completedAt),
        restActualSeconds: s.restActualSeconds,
        restTargetSeconds: s.restTargetSeconds,
        pain: s.pain,
        notes: s.notes,
        clientUpdatedAt: new Date(s.updatedAt),
      };
      await tx.insert(setLog).values(values).onConflictDoUpdate({ target: setLog.id, set: { ...values, id: undefined, userId: undefined } });
    }
  });

  const summaries: Record<string, SessionSummary> = {};
  for (const sessionId of completedNow) {
    const summary = await finalizeSession(userId, sessionId);
    if (summary) summaries[sessionId] = summary;
  }
  if (painReported) await triggerEarlyCheckin(userId, 'pain');
  return { ok: true, summaries, rejected };
}

type SetRow = typeof setLog.$inferSelect;

const toLogged = (s: SetRow): LoggedSet => ({
  weightKg: s.weightKg,
  assistanceKg: s.assistanceKg,
  addedWeightKg: s.addedWeightKg,
  reps: s.reps,
  seconds: s.seconds,
  rir: s.rir,
  completed: s.completedAt !== null,
});

/** Resumen al terminar (sección 7) y récords automáticos (sección 9.1). */
export async function finalizeSession(userId: string, sessionId: string): Promise<SessionSummary | null> {
  const db = getDb();
  const [session] = await db.select().from(workoutSession).where(and(eq(workoutSession.id, sessionId), eq(workoutSession.userId, userId)));
  if (!session) return null;
  const exercises = await db.select().from(sessionExercise).where(eq(sessionExercise.sessionId, sessionId)).orderBy(sessionExercise.sortOrder);
  const sets = exercises.length
    ? await db.select().from(setLog).where(and(inArray(setLog.sessionExerciseId, exercises.map((e) => e.id)), isNotNull(setLog.completedAt))).orderBy(setLog.setNumber)
    : [];
  const end = session.endedAt?.getTime() ?? Date.now();
  const durationSec = Math.round(
    sessionElapsedMs({ startedAt: session.startedAt.getTime(), pausedMs: session.pausedMs, pausedAt: session.pausedAt?.getTime() ?? null, endedAt: end }, end) / 1000,
  );
  const stats = sessionStats(sets.map((s) => ({ ...toLogged(s), restActualSeconds: s.restActualSeconds })), durationSec);

  // Historial previo a esta sesión para los récords.
  const exerciseIds = [...new Set(exercises.map((e) => e.exerciseId))];
  const priorRows = exerciseIds.length
    ? await db
        .select({ set: setLog, exerciseId: sessionExercise.exerciseId, sessionId: sessionExercise.sessionId })
        .from(setLog)
        .innerJoin(sessionExercise, eq(sessionExercise.id, setLog.sessionExerciseId))
        .innerJoin(workoutSession, eq(workoutSession.id, sessionExercise.sessionId))
        .where(
          and(
            eq(setLog.userId, userId),
            inArray(sessionExercise.exerciseId, exerciseIds),
            ne(sessionExercise.sessionId, sessionId),
            isNotNull(setLog.completedAt),
            eq(workoutSession.status, 'completed'),
          ),
        )
    : [];

  const records: SessionSummary['records'] = [];
  const recordSetIds = new Set<string>();
  await db.delete(personalRecord).where(and(eq(personalRecord.userId, userId), inArray(personalRecord.setLogId, sets.length ? sets.map((s) => s.id) : ['-'])));
  for (const ex of exercises) {
    const prior = priorRows.filter((r) => r.exerciseId === ex.exerciseId).map((r) => toLogged(r.set));
    const mine = sets.filter((s) => s.sessionExerciseId === ex.id);
    // Récord = mejor que todo el historial previo; las series anteriores del mismo día no cuentan como historial.
    const best = new Map<RecordType, { value: number; setId: string }>();
    for (const s of mine) {
      for (const r of detectSetRecords(toLogged(s), prior)) {
        const cur = best.get(r.type);
        if (!cur || r.value > cur.value) best.set(r.type, { value: r.value, setId: s.id });
      }
    }
    const bySession = new Map<string, LoggedSet[]>();
    for (const r of priorRows.filter((p) => p.exerciseId === ex.exerciseId)) {
      bySession.set(r.sessionId, [...(bySession.get(r.sessionId) ?? []), toLogged(r.set)]);
    }
    const vol = detectVolumeRecord(mine.map(toLogged), [...bySession.values()]);
    if (vol) best.set('max_volume', { value: vol.value, setId: mine[mine.length - 1]?.id ?? '' });
    if (prior.length === 0 && mine.length > 0) {
      // Nueva variante: primera vez que se hace un ejercicio al que se llega desde otro ya entrenado.
      const [edge] = await db.select({ from: exerciseProgression.fromExerciseId }).from(exerciseProgression).where(eq(exerciseProgression.toExerciseId, ex.exerciseId)).limit(1);
      if (edge) {
        const [didPrev] = await db
          .select({ id: sessionExercise.id })
          .from(sessionExercise)
          .where(and(eq(sessionExercise.userId, userId), eq(sessionExercise.exerciseId, edge.from)))
          .limit(1);
        if (didPrev) best.set('new_variant', { value: 1, setId: mine[0]?.id ?? '' });
      }
    }
    for (const [type, { value, setId }] of best) {
      records.push({ exerciseId: ex.exerciseId, type, value });
      if (setId) recordSetIds.add(setId);
      await db.insert(personalRecord).values({ userId, exerciseId: ex.exerciseId, type, value, setLogId: setId || null, achievedAt: session.endedAt ?? new Date() });
    }
  }
  if (recordSetIds.size > 0) await db.update(setLog).set({ isRecord: true }).where(inArray(setLog.id, [...recordSetIds]));

  // Sesión anterior del mismo día de la rutina.
  let previous: SessionSummary['previous'] = null;
  if (session.routineDayId) {
    const [prev] = await db
      .select({ summary: workoutSession.summary })
      .from(workoutSession)
      .where(and(eq(workoutSession.userId, userId), eq(workoutSession.routineDayId, session.routineDayId), eq(workoutSession.status, 'completed'), ne(workoutSession.id, sessionId), isNotNull(workoutSession.summary)))
      .orderBy(desc(workoutSession.startedAt))
      .limit(1);
    if (prev?.summary) previous = { volumeKg: prev.summary.volumeKg, durationSec: prev.summary.durationSec, avgRestSec: prev.summary.avgRestSec };
  }

  const summary: SessionSummary = {
    durationSec,
    volumeKg: stats.volumeKg,
    completedSets: stats.completedSets,
    avgRestSec: stats.avgRestSec,
    records,
    exercises: exercises.map((e) => {
      const mine = sets.filter((s) => s.sessionExerciseId === e.id);
      return {
        exerciseId: e.exerciseId,
        durationSec: e.startedAt ? Math.round(((e.endedAt ?? session.endedAt ?? new Date()).getTime() - e.startedAt.getTime()) / 1000) : 0,
        volumeKg: Math.round(mine.reduce((acc, s) => acc + setVolume(toLogged(s)), 0) * 10) / 10,
        sets: mine.length,
      };
    }),
    previous,
  };
  await db.update(workoutSession).set({ summary, updatedAt: new Date() }).where(eq(workoutSession.id, sessionId));
  return summary;
}
