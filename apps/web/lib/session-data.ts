import 'server-only';

import { loadCatalogExercises } from '@stenia/catalog';
import {
  alternativesFor,
  bestSet,
  computeTodayTarget,
  epley1rm,
  formatTarget,
  isDeloadWeek,
  setLoad,
  type CatalogExercise,
  type ExerciseSession,
  type LoadType,
  type LoggedSet,
  type TodayTarget,
} from '@stenia/core';
import {
  checkin,
  exercise,
  exerciseMedia,
  exerciseProgression,
  routine,
  routineDay,
  routineExercise,
  sessionExercise,
  setLog,
  workoutSession,
  type ProgressionThreshold,
} from '@stenia/db';
import { and, asc, desc, eq, gte, inArray, isNotNull } from 'drizzle-orm';

import { getDb } from './db';
import { blockWeek, localDateString } from './dates';
import { getActiveGymProfile, incrementsFor, type GymProfileWithEquipment } from './gym';
import { buildContext } from './routine';
import { completeAnswers, getProfile, latestScreening, readAnswers } from './profile';

export type MediaSet = { start: string | null; end: string | null; main: string | null; source: string | null; attributionUrl: string | null };

export type HistorySet = {
  setNumber: number;
  weightKg: number | null;
  assistanceKg: number | null;
  addedWeightKg: number | null;
  reps: number | null;
  seconds: number | null;
  rir: number | null;
};

export type ExerciseBests = {
  maxWeight: number | null;
  maxE1rm: number | null;
  maxSeconds: number | null;
  maxReps: number | null;
  maxVolume: number | null;
  /** Repeticiones máximas logradas con cada peso ("62.5" → 10). */
  repsAtLoad: Record<string, number>;
};

export type ExerciseContext = {
  exerciseId: string;
  slug: string;
  name: string;
  loadType: LoadType;
  pattern: string;
  primaryMuscles: string[];
  equipment: string[];
  media: MediaSet;
  target: TodayTarget;
  targetText: string;
  lastTime: { date: string; sameDay: boolean; sets: HistorySet[] } | null;
  bestText: string | null;
  bestE1rm: number | null;
  bests: ExerciseBests;
  ladder: { previous: { id: string; name: string } | null; next: { id: string; name: string } | null };
};

export type BootstrapExercise = ExerciseContext & {
  routineExerciseId: string;
  sortOrder: number;
  prescription: { sets: number; repMin: number | null; repMax: number | null; targetSeconds: number | null; rirTarget: number; restSeconds: number };
  notes: string | null;
  alternatives: { exerciseId: string; name: string; equipment: string[]; loadType: LoadType }[];
};

export type SessionBootstrap = {
  dayId: string;
  dayName: string;
  routineVersionId: string;
  gymProfileId: string | null;
  blockWeek: number;
  blockWeeks: number;
  deload: boolean;
  generatedAt: string;
  exercises: BootstrapExercise[];
};

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(n);

export function setText(s: HistorySet, loadType: LoadType, variantName?: string): string {
  const rir = s.rir !== null ? ` (RIR ${s.rir})` : '';
  if (loadType === 'isometric') return `${variantName ? `${variantName} × ` : ''}${s.seconds ?? 0} s${rir}`;
  if (loadType === 'assisted') return `asist. ${fmt(s.assistanceKg ?? 0)} kg × ${s.reps ?? 0}${rir}`;
  if (loadType === 'weighted_bw') return `+${fmt(s.addedWeightKg ?? 0)} kg × ${s.reps ?? 0}${rir}`;
  if (loadType === 'bodyweight') return `${s.reps ?? 0} reps${rir}`;
  return `${fmt(s.weightKg ?? 0)} kg × ${s.reps ?? 0}${rir}`;
}

function toLogged(s: HistorySet & { target?: unknown }): LoggedSet {
  return {
    weightKg: s.weightKg,
    assistanceKg: s.assistanceKg,
    addedWeightKg: s.addedWeightKg,
    reps: s.reps,
    seconds: s.seconds,
    rir: s.rir,
    completed: true,
    target: (s.target as LoggedSet['target']) ?? null,
  };
}

/** Historial completo (series terminadas) de varios ejercicios del usuario, más reciente primero. */
export async function exerciseHistory(userId: string, exerciseIds: string[], limitSessions = 12) {
  if (exerciseIds.length === 0) return new Map<string, { sessionId: string; dayId: string | null; date: Date; sets: (HistorySet & { target: unknown })[] }[]>();
  const db = getDb();
  const rows = await db
    .select({
      sessionId: workoutSession.id,
      dayId: workoutSession.routineDayId,
      date: workoutSession.startedAt,
      exerciseId: sessionExercise.exerciseId,
      setNumber: setLog.setNumber,
      weightKg: setLog.weightKg,
      assistanceKg: setLog.assistanceKg,
      addedWeightKg: setLog.addedWeightKg,
      reps: setLog.reps,
      seconds: setLog.seconds,
      rir: setLog.rir,
      target: setLog.target,
    })
    .from(setLog)
    .innerJoin(sessionExercise, eq(sessionExercise.id, setLog.sessionExerciseId))
    .innerJoin(workoutSession, eq(workoutSession.id, sessionExercise.sessionId))
    .where(
      and(
        eq(workoutSession.userId, userId),
        eq(setLog.userId, userId),
        inArray(sessionExercise.exerciseId, exerciseIds),
        isNotNull(setLog.completedAt),
        inArray(workoutSession.status, ['completed', 'active']),
      ),
    )
    .orderBy(desc(workoutSession.startedAt), asc(setLog.setNumber));
  const out = new Map<string, { sessionId: string; dayId: string | null; date: Date; sets: (HistorySet & { target: unknown })[] }[]>();
  for (const r of rows) {
    const list = out.get(r.exerciseId) ?? [];
    let entry = list.find((e) => e.sessionId === r.sessionId);
    if (!entry) {
      if (list.length >= limitSessions) continue;
      entry = { sessionId: r.sessionId, dayId: r.dayId, date: r.date, sets: [] };
      list.push(entry);
      out.set(r.exerciseId, list);
    }
    entry.sets.push(r);
  }
  return out;
}

function computeBests(sessions: { sets: HistorySet[] }[]): ExerciseBests {
  const all = sessions.flatMap((s) => s.sets);
  const loads = all.map((s) => setLoad(s)).filter((v): v is number => v !== null);
  const e1 = all.map((s) => epley1rm(setLoad(s) ?? 0, s.reps ?? 0)).filter((v): v is number => v !== null);
  const repsAtLoad: Record<string, number> = {};
  for (const s of all) {
    const load = setLoad(s);
    if (load === null || s.reps === null) continue;
    repsAtLoad[String(load)] = Math.max(repsAtLoad[String(load)] ?? 0, s.reps);
  }
  const volumes = sessions.map((s) => s.sets.reduce((acc, x) => acc + (setLoad(x) ?? 0) * (x.reps ?? 0), 0)).filter((v) => v > 0);
  return {
    maxWeight: loads.length ? Math.max(...loads) : null,
    maxE1rm: e1.length ? Math.max(...e1) : null,
    maxSeconds: all.some((s) => s.seconds) ? Math.max(...all.map((s) => s.seconds ?? 0)) : null,
    maxReps: all.some((s) => s.reps) ? Math.max(...all.map((s) => s.reps ?? 0)) : null,
    maxVolume: volumes.length ? Math.max(...volumes) : null,
    repsAtLoad,
  };
}

async function mediaFor(exerciseIds: string[]): Promise<Map<string, MediaSet>> {
  const out = new Map<string, MediaSet>();
  if (exerciseIds.length === 0) return out;
  const rows = await getDb()
    .select({ exerciseId: exerciseMedia.exerciseId, role: exerciseMedia.role, url: exerciseMedia.url, source: exerciseMedia.source, attributionUrl: exerciseMedia.attributionUrl })
    .from(exerciseMedia)
    .where(inArray(exerciseMedia.exerciseId, exerciseIds))
    .orderBy(asc(exerciseMedia.sortOrder));
  for (const r of rows) {
    const m = out.get(r.exerciseId) ?? { start: null, end: null, main: null, source: r.source, attributionUrl: r.attributionUrl };
    if (r.role === 'start' && !m.start) m.start = r.url;
    else if (r.role === 'end' && !m.end) m.end = r.url;
    else if (r.role === 'main' && !m.main) m.main = r.url;
    out.set(r.exerciseId, m);
  }
  return out;
}

async function laddersFor(exerciseIds: string[]) {
  const db = getDb();
  if (exerciseIds.length === 0) return new Map<string, { previous: { id: string; name: string; threshold: ProgressionThreshold } | null; next: { id: string; name: string; threshold: ProgressionThreshold } | null }>();
  const [nexts, prevs] = await Promise.all([
    db
      .select({ from: exerciseProgression.fromExerciseId, to: exerciseProgression.toExerciseId, threshold: exerciseProgression.threshold, name: exercise.nameEs })
      .from(exerciseProgression)
      .innerJoin(exercise, eq(exercise.id, exerciseProgression.toExerciseId))
      .where(inArray(exerciseProgression.fromExerciseId, exerciseIds)),
    db
      .select({ from: exerciseProgression.fromExerciseId, to: exerciseProgression.toExerciseId, threshold: exerciseProgression.threshold, name: exercise.nameEs })
      .from(exerciseProgression)
      .innerJoin(exercise, eq(exercise.id, exerciseProgression.fromExerciseId))
      .where(inArray(exerciseProgression.toExerciseId, exerciseIds)),
  ]);
  const out = new Map<string, { previous: { id: string; name: string; threshold: ProgressionThreshold } | null; next: { id: string; name: string; threshold: ProgressionThreshold } | null }>();
  for (const id of exerciseIds) {
    const n = nexts.find((r) => r.from === id);
    const p = prevs.find((r) => r.to === id);
    out.set(id, {
      next: n ? { id: n.to, name: n.name, threshold: n.threshold } : null,
      previous: p ? { id: p.from, name: p.name, threshold: p.threshold } : null,
    });
  }
  return out;
}

/** Peso inicial estimado a partir de las marcas del cuestionario (bloque 4). */
function initialWeight(ex: CatalogExercise, marks: Record<string, number> | null): number | null {
  if (!marks) return null;
  const n = ex.nameEn.toLowerCase();
  if (/bench press|chest press/.test(n) && marks.benchKg) return marks.benchKg * (n.includes('dumbbell') ? 0.4 : 1);
  if (/squat|leg press/.test(n) && marks.squatKg) return marks.squatKg * (n.includes('leg press') ? 1.5 : n.includes('goblet') ? 0.3 : 1);
  if (/row/.test(n) && marks.rowKg) return marks.rowKg * (n.includes('dumbbell') ? 0.45 : 1);
  return null;
}

async function deloadActive(userId: string, view: { startedOn: string | null; blockWeeks: number; deloadEveryWeeks: number }): Promise<boolean> {
  const week = blockWeek(view.startedOn, view.blockWeeks);
  if (isDeloadWeek(week, view.deloadEveryWeeks)) return true;
  // Descarga aceptada en una revisión de los últimos 7 días.
  const since = new Date(Date.now() - 7 * 86_400_000);
  const recent = await getDb()
    .select({ decision: checkin.decision })
    .from(checkin)
    .where(and(eq(checkin.userId, userId), isNotNull(checkin.completedAt), gte(checkin.completedAt, since)));
  return recent.some((r) => Array.isArray((r.decision as { accepted?: unknown }).accepted) && ((r.decision as { accepted: { kind: string }[] }).accepted).some((a) => a.kind === 'deload'));
}

type ContextInput = {
  userId: string;
  ex: CatalogExercise;
  prescription: BootstrapExercise['prescription'];
  history: Awaited<ReturnType<typeof exerciseHistory>>;
  dayId: string | null;
  media: Map<string, MediaSet>;
  ladders: Awaited<ReturnType<typeof laddersFor>>;
  gym: GymProfileWithEquipment | null;
  deload: boolean;
  marks: Record<string, number> | null;
};

function buildExerciseContext(input: ContextInput): ExerciseContext {
  const { ex, prescription } = input;
  const sessions = input.history.get(ex.id) ?? [];
  const sameDay = sessions.find((s) => input.dayId && s.dayId === input.dayId);
  const last = sameDay ?? sessions[0] ?? null;
  const ladder = input.ladders.get(ex.id) ?? { previous: null, next: null };
  const progressionHistory: ExerciseSession[] = sessions.map((s) => ({ date: s.date.toISOString(), exerciseId: ex.id, sets: s.sets.map(toLogged) }));
  const target = computeTodayTarget({
    prescription: { loadType: ex.loadType, ...prescription },
    history: progressionHistory,
    increments: incrementsFor(ex.equipment, input.gym),
    ladder: {
      previousId: ladder.previous?.id ?? null,
      nextId: ladder.next?.id ?? null,
      threshold: ladder.next?.threshold ?? null,
    },
    deload: input.deload,
    initialWeightKg: initialWeight(ex, input.marks),
  });
  const best = bestSet(sessions.flatMap((s) => s.sets.map(toLogged)));
  const bests = computeBests(sessions);
  return {
    exerciseId: ex.id,
    slug: ex.slug,
    name: ex.nameEs,
    loadType: ex.loadType,
    pattern: ex.pattern,
    primaryMuscles: ex.primaryMuscles,
    equipment: ex.equipment,
    media: input.media.get(ex.id) ?? { start: null, end: null, main: null, source: null, attributionUrl: null },
    target,
    targetText: formatTarget(target, ex.loadType),
    lastTime: last ? { date: last.date.toISOString(), sameDay: Boolean(sameDay), sets: last.sets } : null,
    bestText: best ? setText({ setNumber: 0, ...best }, ex.loadType) : null,
    bestE1rm: bests.maxE1rm,
    bests,
    ladder: {
      previous: ladder.previous ? { id: ladder.previous.id, name: ladder.previous.name } : null,
      next: ladder.next ? { id: ladder.next.id, name: ladder.next.name } : null,
    },
  };
}

async function commonInputs(userId: string) {
  const [catalog, gym, profileRow, screeningRow] = await Promise.all([
    loadCatalogExercises(getDb()),
    getActiveGymProfile(userId),
    getProfile(userId),
    latestScreening(userId),
  ]);
  const q = completeAnswers(readAnswers(profileRow));
  const ctx = q ? buildContext(q, (screeningRow?.intensityCap as never) ?? 'moderate', gym) : null;
  return { catalog, byId: new Map(catalog.map((e) => [e.id, e])), gym, ctx, marks: (profileRow?.currentLevel as Record<string, number> | null) ?? null };
}

/** Todo lo que necesita la sesión en vivo para un día de la rutina; el cliente lo guarda en IndexedDB. */
export async function buildBootstrap(userId: string, dayId: string): Promise<SessionBootstrap | null> {
  const db = getDb();
  const [day] = await db
    .select({ day: routineDay, routine })
    .from(routineDay)
    .innerJoin(routine, eq(routine.currentVersionId, routineDay.routineVersionId))
    .where(and(eq(routineDay.id, dayId), eq(routine.userId, userId)));
  if (!day) return null;
  const items = await db.select().from(routineExercise).where(eq(routineExercise.routineDayId, dayId)).orderBy(asc(routineExercise.sortOrder));
  const { byId, catalog, gym, ctx, marks } = await commonInputs(userId);
  const ids = items.map((i) => i.exerciseId);
  const altIds = new Set<string>();
  const alternativesById = new Map<string, CatalogExercise[]>();
  for (const id of ids) {
    const ex = byId.get(id);
    if (!ex || !ctx) continue;
    const alts = alternativesFor(ex, catalog, ctx, { limit: 8 });
    alternativesById.set(id, alts);
    for (const a of alts) altIds.add(a.id);
  }
  const [history, media, ladders, deload] = await Promise.all([
    exerciseHistory(userId, ids),
    mediaFor(ids),
    laddersFor(ids),
    deloadActive(userId, { startedOn: day.routine.startedOn, blockWeeks: day.routine.blockWeeks, deloadEveryWeeks: day.routine.deloadEveryWeeks }),
  ]);
  const exercises: BootstrapExercise[] = [];
  for (const item of items) {
    const ex = byId.get(item.exerciseId);
    if (!ex) continue;
    const prescription = {
      sets: item.sets,
      repMin: item.repMin,
      repMax: item.repMax,
      targetSeconds: item.targetSeconds,
      rirTarget: item.rirTarget,
      restSeconds: item.restSeconds,
    };
    exercises.push({
      ...buildExerciseContext({ userId, ex, prescription, history, dayId, media, ladders, gym, deload, marks }),
      routineExerciseId: item.id,
      sortOrder: item.sortOrder,
      prescription,
      notes: item.notes,
      alternatives: (alternativesById.get(ex.id) ?? []).map((a) => ({ exerciseId: a.id, name: a.nameEs, equipment: a.equipment, loadType: a.loadType })),
    });
  }
  return {
    dayId,
    dayName: day.day.name,
    routineVersionId: day.day.routineVersionId,
    gymProfileId: gym?.id ?? null,
    blockWeek: blockWeek(day.routine.startedOn, day.routine.blockWeeks),
    blockWeeks: day.routine.blockWeeks,
    deload,
    generatedAt: new Date().toISOString(),
    exercises,
  };
}

/** Contexto de un ejercicio sustituto en plena sesión (requiere conexión). */
export async function buildExerciseContextFor(
  userId: string,
  exerciseId: string,
  dayId: string | null,
  prescription: BootstrapExercise['prescription'],
): Promise<ExerciseContext | null> {
  const { byId, gym, marks } = await commonInputs(userId);
  const ex = byId.get(exerciseId);
  if (!ex) return null;
  const [history, media, ladders] = await Promise.all([exerciseHistory(userId, [ex.id]), mediaFor([ex.id]), laddersFor([ex.id])]);
  const adjusted = ex.loadType === 'isometric'
    ? { ...prescription, repMin: null, repMax: null, targetSeconds: prescription.targetSeconds ?? 30 }
    : { ...prescription, targetSeconds: null, repMin: prescription.repMin ?? 8, repMax: prescription.repMax ?? 12 };
  return buildExerciseContext({ userId, ex, prescription: adjusted, history, dayId, media, ladders, gym, deload: false, marks });
}

export async function routineDayIds(userId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ id: routineDay.id })
    .from(routineDay)
    .innerJoin(routine, eq(routine.currentVersionId, routineDay.routineVersionId))
    .where(and(eq(routine.userId, userId), eq(routine.status, 'active')))
    .orderBy(asc(routineDay.sortOrder));
  return rows.map((r) => r.id);
}

export { localDateString };
