'use client';

import { detectSetRecords, type LoadType, type LoggedSet } from '@stenia/core';

import { enqueue, localDb, snapshotFrom, type LocalExercise, type LocalSession, type LocalSet } from '@/lib/local-db';
import type { BootstrapExercise, ExerciseContext, HistorySet, SessionBootstrap } from '@/lib/session-data';
import { flushOutbox } from '@/lib/sync-client';

export const uuid = () => crypto.randomUUID();

/** Valores precargados: los de la última vez, ajustados a la meta de hoy (registrar = 1 toque). */
export function prefillSet(
  ctx: Pick<BootstrapExercise, 'loadType' | 'target' | 'lastTime' | 'prescription'>,
  index: number,
): Pick<LocalSet, 'weightKg' | 'assistanceKg' | 'addedWeightKg' | 'reps' | 'seconds' | 'rir' | 'target'> {
  const last: HistorySet | undefined = ctx.lastTime?.sets[index] ?? ctx.lastTime?.sets[ctx.lastTime.sets.length - 1];
  const t = ctx.target;
  const weightKg = ctx.loadType === 'external' ? (t.weightKg ?? last?.weightKg ?? null) : null;
  const sameLoad = last && (ctx.loadType !== 'external' || last.weightKg === weightKg);
  const reps =
    ctx.loadType === 'isometric'
      ? null
      : sameLoad && last?.reps
        ? Math.max(last.reps, t.repMin ?? 0)
        : (t.repMin ?? ctx.prescription.repMin ?? 8);
  return {
    weightKg,
    assistanceKg: ctx.loadType === 'assisted' ? (t.assistanceKg ?? last?.assistanceKg ?? 0) : null,
    addedWeightKg: ctx.loadType === 'weighted_bw' ? (t.addedWeightKg ?? last?.addedWeightKg ?? 0) : null,
    reps,
    seconds: ctx.loadType === 'isometric' ? (t.targetSeconds ?? ctx.prescription.targetSeconds ?? 20) : null,
    rir: null,
    target: {
      weightKg: t.weightKg,
      assistanceKg: t.assistanceKg,
      addedWeightKg: t.addedWeightKg,
      repMin: t.repMin,
      repMax: t.repMax,
      seconds: t.targetSeconds,
    },
  };
}

function plannedSets(sessionId: string, exerciseId: string, ctx: BootstrapExercise, now: number): LocalSet[] {
  return Array.from({ length: ctx.prescription.sets }, (_, i) => ({
    id: uuid(),
    sessionExerciseId: exerciseId,
    sessionId,
    setNumber: i + 1,
    ...prefillSet(ctx, i),
    startedAt: null,
    completedAt: null,
    restActualSeconds: null,
    restTargetSeconds: ctx.prescription.restSeconds,
    pain: false,
    notes: null,
    isRecord: false,
    updatedAt: now,
  }));
}

/** Crea la sesión en IndexedDB a partir del bootstrap (funciona sin conexión si el bootstrap está guardado). */
export async function startSession(bootstrap: SessionBootstrap): Promise<string> {
  const db = localDb();
  const now = Date.now();
  const sessionId = uuid();
  const session: LocalSession = {
    id: sessionId,
    routineVersionId: bootstrap.routineVersionId,
    routineDayId: bootstrap.dayId,
    dayName: bootstrap.dayName,
    gymProfileId: bootstrap.gymProfileId,
    status: 'active',
    startedAt: now,
    endedAt: null,
    pausedMs: 0,
    pausedAt: null,
    effort: null,
    notes: null,
    currentIndex: 0,
    rest: null,
    deload: bootstrap.deload,
    blockWeek: bootstrap.blockWeek,
    blockWeeks: bootstrap.blockWeeks,
    summary: null,
    updatedAt: now,
  };
  const exercises: LocalExercise[] = bootstrap.exercises.map((ex, i) => ({
    id: uuid(),
    sessionId,
    routineExerciseId: ex.routineExerciseId,
    exerciseId: ex.exerciseId,
    sortOrder: i,
    startedAt: null,
    endedAt: null,
    substitutedFromExerciseId: null,
    notes: null,
    snapshot: snapshotFrom(ex),
    updatedAt: now,
  }));
  const sets = exercises.flatMap((e, i) => plannedSets(sessionId, e.id, bootstrap.exercises[i] as BootstrapExercise, now));
  await db.transaction('rw', db.sessions, db.exercises, db.sets, db.outbox, async () => {
    await db.sessions.add(session);
    await db.exercises.bulkAdd(exercises);
    await db.sets.bulkAdd(sets);
    await enqueue('session', sessionId);
    for (const e of exercises) await enqueue('exercise', e.id);
  });
  void flushOutbox();
  return sessionId;
}

export async function updateSession(id: string, patch: Partial<LocalSession>) {
  const db = localDb();
  await db.sessions.update(id, { ...patch, updatedAt: Date.now() });
  await enqueue('session', id);
  void flushOutbox();
}

export async function updateExercise(id: string, patch: Partial<LocalExercise>) {
  const db = localDb();
  await db.exercises.update(id, { ...patch, updatedAt: Date.now() });
  await enqueue('exercise', id);
  void flushOutbox();
}

export async function updateSet(id: string, patch: Partial<LocalSet>, sync = true) {
  const db = localDb();
  await db.sets.update(id, { ...patch, updatedAt: Date.now() });
  await enqueue('set', id);
  if (sync) void flushOutbox();
}

type NumericSetField = 'weightKg' | 'assistanceKg' | 'addedWeightKg' | 'reps' | 'seconds';

/** Suma atómica en IndexedDB: dos toques rápidos en +/− nunca se pierden. */
export async function stepSet(id: string, field: NumericSetField, delta: number, min = 0, max = 1000) {
  const db = localDb();
  await db.transaction('rw', db.sets, db.outbox, async () => {
    const row = await db.sets.get(id);
    if (!row) return;
    const next = Math.min(max, Math.max(min, Math.round(((row[field] ?? 0) + delta) * 100) / 100));
    await db.sets.update(id, { [field]: next, updatedAt: Date.now() });
    await enqueue('set', id);
  });
}

export function toLogged(s: LocalSet): LoggedSet {
  return {
    weightKg: s.weightKg,
    assistanceKg: s.assistanceKg,
    addedWeightKg: s.addedWeightKg,
    reps: s.reps,
    seconds: s.seconds,
    rir: s.rir,
    completed: s.completedAt !== null,
  };
}

/** Récords al marcar la serie, contra lo mejor del historial y lo hecho hoy (sección 9.1). */
export function localRecords(set: LocalSet, snapshot: LocalExercise['snapshot'], earlierToday: LocalSet[]) {
  const b = snapshot.bests;
  const synthetic: LoggedSet[] = [];
  const base = { assistanceKg: null, addedWeightKg: null, rir: null, completed: true } as const;
  if (b.maxWeight !== null) synthetic.push({ ...base, weightKg: b.maxWeight, reps: 1, seconds: null });
  for (const [load, reps] of Object.entries(b.repsAtLoad)) synthetic.push({ ...base, weightKg: Number(load), reps, seconds: null });
  if (b.maxSeconds !== null) synthetic.push({ ...base, weightKg: null, reps: null, seconds: b.maxSeconds });
  if (b.maxE1rm !== null) synthetic.push({ ...base, weightKg: b.maxE1rm, reps: 1, seconds: null });
  if (synthetic.length === 0) return [];
  // Solo el historial previo: superar una serie anterior del mismo día no es un récord.
  void earlierToday;
  const history = synthetic;
  const asExternal = snapshot.loadType === 'weighted_bw' ? { ...toLogged(set), weightKg: set.addedWeightKg } : toLogged(set);
  return detectSetRecords({ ...asExternal, completed: true }, history);
}

/** Descanso real aproximado: entre series marcadas, menos el tiempo estimado de trabajo. */
export function estimateActualRest(previousCompletedAt: number | null, now: number, loadType: LoadType, reps: number | null, seconds: number | null): number | null {
  if (previousCompletedAt === null) return null;
  const work = loadType === 'isometric' ? (seconds ?? 20) : Math.max(10, (reps ?? 8) * 3);
  return Math.max(0, Math.round((now - previousCompletedAt) / 1000 - work));
}

/** Sustituye un ejercicio por otro del mismo patrón y repone las series pendientes. */
export async function substituteExercise(exercise: LocalExercise, alt: { exerciseId: string; name: string; equipment: string[]; loadType: LoadType }, dayId: string | null) {
  const db = localDb();
  const p = exercise.snapshot.prescription;
  let context: ExerciseContext | null = null;
  try {
    const params = new URLSearchParams({
      exerciseId: alt.exerciseId,
      dayId: dayId ?? '',
      sets: String(p.sets),
      repMin: p.repMin === null ? '' : String(p.repMin),
      repMax: p.repMax === null ? '' : String(p.repMax),
      targetSeconds: p.targetSeconds === null ? '' : String(p.targetSeconds),
      rirTarget: String(p.rirTarget),
      restSeconds: String(p.restSeconds),
    });
    const res = await fetch(`/api/exercises/context?${params.toString()}`);
    if (res.ok) context = ((await res.json()) as { context: ExerciseContext }).context;
  } catch {
    context = null;
  }
  const prescription =
    alt.loadType === 'isometric'
      ? { ...p, repMin: null, repMax: null, targetSeconds: p.targetSeconds ?? 30 }
      : { ...p, targetSeconds: null, repMin: p.repMin ?? 8, repMax: p.repMax ?? 12 };
  const snapshot = context
    ? snapshotFrom({ ...context, prescription, alternatives: exercise.snapshot.alternatives, notes: null })
    : {
        ...exercise.snapshot,
        name: alt.name,
        slug: '',
        loadType: alt.loadType,
        equipment: alt.equipment,
        media: { start: null, end: null, main: null, source: null, attributionUrl: null },
        lastTime: null,
        bestText: null,
        bestE1rm: null,
        bests: { maxWeight: null, maxE1rm: null, maxSeconds: null, maxReps: null, maxVolume: null, repsAtLoad: {} },
        ladder: { previous: null, next: null },
        prescription,
        target: { ...exercise.snapshot.target, weightKg: null, assistanceKg: null, addedWeightKg: null, repMin: prescription.repMin, repMax: prescription.repMax, targetSeconds: prescription.targetSeconds, suggestedExerciseId: null, action: 'start' as const, reason: 'Sustituto sin conexión: elige un peso con RIR 2–3.' },
        targetText: 'Sin historial',
      };
  await updateExercise(exercise.id, {
    exerciseId: alt.exerciseId,
    substitutedFromExerciseId: exercise.substitutedFromExerciseId ?? exercise.exerciseId,
    snapshot,
  });
  const sets = await db.sets.where('sessionExerciseId').equals(exercise.id).toArray();
  const now = Date.now();
  for (const s of sets.filter((x) => x.completedAt === null)) {
    await updateSet(s.id, { ...prefillSet({ loadType: snapshot.loadType, target: snapshot.target, lastTime: snapshot.lastTime, prescription: snapshot.prescription }, s.setNumber - 1), updatedAt: now }, false);
  }
  void flushOutbox();
}
