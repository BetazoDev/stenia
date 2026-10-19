import 'server-only';

import {
  effectiveSetsByMuscle,
  epley1rm,
  weeklyAdherence,
  type LoggedSet,
  type MuscleGroup,
} from '@stenia/core';
import { exercise, personalRecord, routineDay, sessionExercise, setLog, workoutSession } from '@stenia/db';
import { and, desc, eq, gte, isNotNull } from 'drizzle-orm';

import { getDb } from './db';
import { getActiveRoutine } from './routine';
import { currentWeekBounds } from './time';

type SetWithExercise = {
  set: typeof setLog.$inferSelect;
  exerciseId: string;
  slug: string;
  name: string;
  loadType: string;
  primary: string[];
  secondary: string[];
  sessionId: string;
  startedAt: Date;
};

async function setsSince(userId: string, since: Date): Promise<SetWithExercise[]> {
  return getDb()
    .select({
      set: setLog,
      exerciseId: exercise.id,
      slug: exercise.slug,
      name: exercise.nameEs,
      loadType: exercise.loadType,
      primary: exercise.primaryMuscles,
      secondary: exercise.secondaryMuscles,
      sessionId: workoutSession.id,
      startedAt: workoutSession.startedAt,
    })
    .from(setLog)
    .innerJoin(sessionExercise, eq(sessionExercise.id, setLog.sessionExerciseId))
    .innerJoin(workoutSession, eq(workoutSession.id, sessionExercise.sessionId))
    .innerJoin(exercise, eq(exercise.id, sessionExercise.exerciseId))
    .where(and(eq(setLog.userId, userId), isNotNull(setLog.completedAt), eq(workoutSession.status, 'completed'), gte(workoutSession.startedAt, since)));
}

const logged = (s: typeof setLog.$inferSelect): LoggedSet => ({
  weightKg: s.weightKg,
  assistanceKg: s.assistanceKg,
  addedWeightKg: s.addedWeightKg,
  reps: s.reps,
  seconds: s.seconds,
  rir: s.rir,
  completed: s.completedAt !== null,
});

export async function getProgressOverview(userId: string) {
  const db = getDb();
  const { start: weekStart } = currentWeekBounds();
  const lastWeekStart = new Date(weekStart.getTime() - 7 * 86_400_000);
  const eightWeeks = new Date(weekStart.getTime() - 7 * 7 * 86_400_000);
  const [recentSets, sessions, records, routine] = await Promise.all([
    setsSince(userId, eightWeeks),
    db
      .select({ id: workoutSession.id, startedAt: workoutSession.startedAt, summary: workoutSession.summary, effort: workoutSession.effort, dayName: routineDay.name })
      .from(workoutSession)
      .leftJoin(routineDay, eq(routineDay.id, workoutSession.routineDayId))
      .where(and(eq(workoutSession.userId, userId), eq(workoutSession.status, 'completed')))
      .orderBy(desc(workoutSession.startedAt))
      .limit(60),
    db
      .select({ id: personalRecord.id, type: personalRecord.type, value: personalRecord.value, achievedAt: personalRecord.achievedAt, name: exercise.nameEs, slug: exercise.slug })
      .from(personalRecord)
      .innerJoin(exercise, eq(exercise.id, personalRecord.exerciseId))
      .where(eq(personalRecord.userId, userId))
      .orderBy(desc(personalRecord.achievedAt))
      .limit(12),
    getActiveRoutine(userId),
  ]);

  const toEntry = (r: SetWithExercise) => ({ set: logged(r.set), primary: r.primary as MuscleGroup[], secondary: r.secondary as MuscleGroup[] });
  const thisWeek = effectiveSetsByMuscle(recentSets.filter((r) => r.startedAt >= weekStart).map(toEntry));
  const lastWeek = effectiveSetsByMuscle(recentSets.filter((r) => r.startedAt >= lastWeekStart && r.startedAt < weekStart).map(toEntry));
  const planned = routine?.days.length ?? 0;
  const adherence = weeklyAdherence(sessions.map((s) => s.startedAt.toISOString()), planned, 8);

  const trained = new Map<string, { slug: string; name: string; sessions: Set<string>; last: Date }>();
  for (const r of recentSets) {
    const t = trained.get(r.exerciseId) ?? { slug: r.slug, name: r.name, sessions: new Set<string>(), last: r.startedAt };
    t.sessions.add(r.sessionId);
    if (r.startedAt > t.last) t.last = r.startedAt;
    trained.set(r.exerciseId, t);
  }

  const volumeThis = recentSets.filter((r) => r.startedAt >= weekStart).reduce((a, r) => a + (r.set.weightKg ?? r.set.addedWeightKg ?? 0) * (r.set.reps ?? 0), 0);
  const volumeLast = recentSets
    .filter((r) => r.startedAt >= lastWeekStart && r.startedAt < weekStart)
    .reduce((a, r) => a + (r.set.weightKg ?? r.set.addedWeightKg ?? 0) * (r.set.reps ?? 0), 0);

  return {
    thisWeek,
    lastWeek,
    planned,
    adherence,
    sessions: sessions.slice(0, 12),
    records,
    volume: { thisWeek: Math.round(volumeThis), lastWeek: Math.round(volumeLast) },
    sessionsThisWeek: sessions.filter((s) => s.startedAt >= weekStart).length,
    sessionsLastWeek: sessions.filter((s) => s.startedAt >= lastWeekStart && s.startedAt < weekStart).length,
    trained: [...trained.entries()]
      .map(([id, t]) => ({ id, slug: t.slug, name: t.name, sessions: t.sessions.size, last: t.last }))
      .sort((a, b) => b.last.getTime() - a.last.getTime()),
  };
}

export type ExerciseSeriesPoint = {
  date: string;
  bestWeight: number | null;
  e1rm: number | null;
  volume: number;
  bestReps: number | null;
  bestSeconds: number | null;
  /** Repeticiones con el peso de trabajo actual. */
  repsAtWorking: number | null;
};

export async function getExerciseProgress(userId: string, slug: string) {
  const db = getDb();
  const [ex] = await db.select().from(exercise).where(eq(exercise.slug, slug)).limit(1);
  if (!ex) return null;
  const rows = await db
    .select({ set: setLog, sessionId: workoutSession.id, startedAt: workoutSession.startedAt })
    .from(setLog)
    .innerJoin(sessionExercise, eq(sessionExercise.id, setLog.sessionExerciseId))
    .innerJoin(workoutSession, eq(workoutSession.id, sessionExercise.sessionId))
    .where(and(eq(setLog.userId, userId), eq(sessionExercise.exerciseId, ex.id), isNotNull(setLog.completedAt), eq(workoutSession.status, 'completed')))
    .orderBy(workoutSession.startedAt);
  const bySession = new Map<string, { date: Date; sets: (typeof setLog.$inferSelect)[] }>();
  for (const r of rows) {
    const entry = bySession.get(r.sessionId) ?? { date: r.startedAt, sets: [] };
    entry.sets.push(r.set);
    bySession.set(r.sessionId, entry);
  }
  const sessions = [...bySession.values()];
  const working = sessions.length > 0 ? Math.max(...(sessions[sessions.length - 1]?.sets.map((s) => s.weightKg ?? s.addedWeightKg ?? 0) ?? [0])) : 0;
  const points: ExerciseSeriesPoint[] = sessions.map(({ date, sets }) => {
    const loads = sets.map((s) => s.weightKg ?? s.addedWeightKg ?? null).filter((v): v is number => v !== null && v > 0);
    const e1 = sets.map((s) => epley1rm(s.weightKg ?? s.addedWeightKg ?? 0, s.reps ?? 0)).filter((v): v is number => v !== null);
    const atWorking = sets.filter((s) => (s.weightKg ?? s.addedWeightKg ?? 0) === working && working > 0).map((s) => s.reps ?? 0);
    return {
      date: date.toISOString().slice(0, 10),
      bestWeight: loads.length ? Math.max(...loads) : null,
      e1rm: e1.length ? Math.max(...e1) : null,
      volume: Math.round(sets.reduce((a, s) => a + (s.weightKg ?? s.addedWeightKg ?? 0) * (s.reps ?? 0), 0)),
      bestReps: sets.some((s) => s.reps) ? Math.max(...sets.map((s) => s.reps ?? 0)) : null,
      bestSeconds: sets.some((s) => s.seconds) ? Math.max(...sets.map((s) => s.seconds ?? 0)) : null,
      repsAtWorking: atWorking.length ? Math.max(...atWorking) : null,
    };
  });
  const records = await db
    .select()
    .from(personalRecord)
    .where(and(eq(personalRecord.userId, userId), eq(personalRecord.exerciseId, ex.id)))
    .orderBy(desc(personalRecord.achievedAt));
  return { exercise: ex, points, records, workingWeight: working || null };
}

export async function recentRecords(userId: string, limit = 5) {
  return getDb()
    .select({ id: personalRecord.id, type: personalRecord.type, value: personalRecord.value, achievedAt: personalRecord.achievedAt, name: exercise.nameEs, slug: exercise.slug })
    .from(personalRecord)
    .innerJoin(exercise, eq(exercise.id, personalRecord.exerciseId))
    .where(and(eq(personalRecord.userId, userId), gte(personalRecord.achievedAt, new Date(Date.now() - 14 * 86_400_000))))
    .orderBy(desc(personalRecord.achievedAt))
    .limit(limit);
}
