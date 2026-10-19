import 'server-only';

import { CheckinAnalysis, checkinPrompt } from '@stenia/ai';
import { loadCatalogExercises } from '@stenia/catalog';
import {
  CheckinAnswers,
  MuscleGroup,
  alternativesFor,
  applyAdjustments,
  changesRoutine,
  deterministicProposals,
  detectTriggers,
  ema,
  epley1rm,
  evaluateScreening,
  expectedWeeklyChangePct,
  isStagnant,
  nextCheckinDates,
  weeklyAdherence,
  weeklySlope,
  type Adjustment,
  type CheckinMode,
  type CheckinType,
  type DetectedTrigger,
  type Goal,
  type IntensityCap,
  type PerformancePoint,
  type RoutinePlan,
} from '@stenia/core';
import { checkin, checkinSettings, exercise, personalRecord, profile, sessionExercise, setLog, workoutSession } from '@stenia/db';
import { and, asc, desc, eq, gte, isNull, lte } from 'drizzle-orm';
import { z } from 'zod';

import { runAi } from './ai';
import { addMeasurement, weightSeries } from './body';
import { triggerEarlyCheckin, TRIGGER_LABELS_ES, type EarlyTrigger } from './checkins-trigger';
import { getDb } from './db';
import { addDays, localDateString } from './dates';
import { getActiveGymProfile } from './gym';
import { completeAnswers, getProfile, latestScreening, readAnswers } from './profile';
import { buildContext, getActiveRoutine, saveRoutinePlan, type RoutineView } from './routine';
import { exerciseHistory } from './session-data';
import { currentWeekBounds, weekdayIndex } from './time';

export type CheckinRow = typeof checkin.$inferSelect;

// ── Configuración y calendario ────────────────────────────────────────────────────────────

export async function getCheckinSettings(userId: string) {
  const db = getDb();
  const [row] = await db.select().from(checkinSettings).where(eq(checkinSettings.userId, userId)).limit(1);
  if (row) return row;
  const today = localDateString();
  const next = nextCheckinDates('auto', null, null, today);
  const [created] = await db
    .insert(checkinSettings)
    .values({ userId, mode: 'auto', nextLightAt: next.light, nextFullAt: next.full })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [again] = await db.select().from(checkinSettings).where(eq(checkinSettings.userId, userId)).limit(1);
  if (!again) throw new Error('No se pudo crear la configuración de revisiones.');
  return again;
}

async function lastCompleted(userId: string, type: CheckinType): Promise<string | null> {
  const [row] = await getDb()
    .select({ scheduledFor: checkin.scheduledFor, completedAt: checkin.completedAt })
    .from(checkin)
    .where(and(eq(checkin.userId, userId), eq(checkin.type, type)))
    .orderBy(desc(checkin.completedAt))
    .limit(1);
  return row?.completedAt ? localDateString(row.completedAt) : null;
}

export async function setCheckinMode(userId: string, mode: CheckinMode) {
  await getCheckinSettings(userId);
  const today = localDateString();
  const next = nextCheckinDates(mode, await lastCompleted(userId, 'light'), await lastCompleted(userId, 'full'), today);
  await getDb()
    .update(checkinSettings)
    .set({ mode, nextLightAt: next.light, nextFullAt: next.full, updatedAt: new Date() })
    .where(eq(checkinSettings.userId, userId));
}

/** Crea las revisiones programadas que vencieron. Devuelve las que se crearon ahora (para notificar). */
export async function ensureScheduledCheckins(userId: string, today = localDateString()): Promise<CheckinRow[]> {
  const db = getDb();
  const settings = await getCheckinSettings(userId);
  const pending = await db
    .select()
    .from(checkin)
    .where(and(eq(checkin.userId, userId), isNull(checkin.completedAt), isNull(checkin.dismissedAt)));
  const created: CheckinRow[] = [];
  const fullDue = settings.nextFullAt !== null && settings.nextFullAt <= today;
  const lightDue = settings.nextLightAt !== null && settings.nextLightAt <= today;
  if (fullDue && !pending.some((c) => c.type === 'full')) {
    const [row] = await db.insert(checkin).values({ userId, type: 'full', scheduledFor: settings.nextFullAt as string }).returning();
    if (row) created.push(row);
  } else if (lightDue && !fullDue && !pending.some((c) => c.type === 'light' || c.type === 'full')) {
    const [row] = await db.insert(checkin).values({ userId, type: 'light', scheduledFor: settings.nextLightAt as string }).returning();
    if (row) created.push(row);
  }
  return created;
}

export async function pendingCheckins(userId: string, today = localDateString()) {
  return getDb()
    .select()
    .from(checkin)
    .where(and(eq(checkin.userId, userId), isNull(checkin.completedAt), isNull(checkin.dismissedAt), lte(checkin.scheduledFor, today)))
    .orderBy(asc(checkin.scheduledFor));
}

export async function listCheckins(userId: string, limit = 30) {
  return getDb().select().from(checkin).where(eq(checkin.userId, userId)).orderBy(desc(checkin.scheduledFor), desc(checkin.createdAt)).limit(limit);
}

export async function getCheckin(userId: string, id: string) {
  const [row] = await getDb().select().from(checkin).where(and(eq(checkin.userId, userId), eq(checkin.id, id))).limit(1);
  return row ?? null;
}

/** Abre una revisión a petición del usuario (tipo ligera o completa) si no hay otra pendiente. */
export async function openCheckinNow(userId: string, type: 'light' | 'full'): Promise<string> {
  const db = getDb();
  const [open] = await db
    .select({ id: checkin.id })
    .from(checkin)
    .where(and(eq(checkin.userId, userId), eq(checkin.type, type), isNull(checkin.completedAt), isNull(checkin.dismissedAt)))
    .limit(1);
  if (open) return open.id;
  const [row] = await db.insert(checkin).values({ userId, type, scheduledFor: localDateString() }).returning({ id: checkin.id });
  if (!row) throw new Error('No se pudo abrir la revisión.');
  return row.id;
}

export async function dismissCheckin(userId: string, id: string) {
  await getDb().update(checkin).set({ dismissedAt: new Date() }).where(and(eq(checkin.userId, userId), eq(checkin.id, id), isNull(checkin.completedAt)));
}

// ── Métricas (el código calcula; el LLM solo resume) ──────────────────────────────────────

type MainLift = { id: string; name: string; pattern: string; loadType: string; points: PerformancePoint[] };

function performanceScore(loadType: string, sets: { weightKg: number | null; addedWeightKg: number | null; assistanceKg: number | null; reps: number | null; seconds: number | null }[]): number | null {
  if (loadType === 'isometric') {
    const s = Math.max(0, ...sets.map((x) => x.seconds ?? 0));
    return s > 0 ? s : null;
  }
  const e1 = sets
    .map((x) => {
      const load = (x.weightKg ?? 0) + (x.addedWeightKg ?? 0) - (x.assistanceKg ?? 0);
      return load > 0 ? epley1rm(load, x.reps ?? 0) : null;
    })
    .filter((v): v is number => v !== null);
  if (e1.length > 0) return Math.max(...e1);
  const reps = Math.max(0, ...sets.map((x) => x.reps ?? 0));
  return reps > 0 ? reps : null;
}

async function mainLifts(userId: string, view: RoutineView | null): Promise<MainLift[]> {
  if (!view) return [];
  const seen = new Map<string, { name: string; pattern: string; loadType: string }>();
  for (const d of view.days) {
    for (const e of d.exercises.slice(0, 2)) seen.set(e.exerciseId, { name: e.exercise.nameEs, pattern: e.exercise.pattern, loadType: e.exercise.loadType });
  }
  const history = await exerciseHistory(userId, [...seen.keys()], 16);
  return [...seen.entries()].map(([id, meta]) => ({
    id,
    ...meta,
    points: (history.get(id) ?? [])
      .map((s) => ({ date: s.date.toISOString().slice(0, 10), score: performanceScore(meta.loadType, s.sets) }))
      .filter((p): p is PerformancePoint => p.score !== null),
  }));
}

export type CheckinMetrics = {
  weight: { last: number | null; trend: number | null; slopeKgPerWeek: number | null; slopePctPerWeek: number | null; weighIns14d: number; expected: { min: number; max: number } };
  /** avgPct es null mientras no haya una semana completa desde el inicio de la rutina. */
  adherence: { weeks: { weekStart: string; done: number; pct: number }[]; avgPct: number | null; plannedPerWeek: number };
  sessions: { count14d: number; avgEffort: number | null };
  stagnant: { id: string; name: string }[];
  improving: { id: string; name: string; changePct: number }[];
  records14d: number;
  painExercises: { id: string; name: string }[];
  triggers: DetectedTrigger[];
};

async function painExercisesSince(userId: string, since: Date) {
  const rows = await getDb()
    .selectDistinct({ id: exercise.id, name: exercise.nameEs })
    .from(setLog)
    .innerJoin(sessionExercise, eq(sessionExercise.id, setLog.sessionExerciseId))
    .innerJoin(exercise, eq(exercise.id, sessionExercise.exerciseId))
    .where(and(eq(setLog.userId, userId), eq(setLog.pain, true), gte(setLog.completedAt, since)));
  return rows;
}

export async function computeMetrics(userId: string, now = new Date()): Promise<CheckinMetrics> {
  const db = getDb();
  const [p] = await db.select({ goal: profile.goal }).from(profile).where(eq(profile.userId, userId));
  const goal = (p?.goal ?? 'hypertrophy') as Goal;
  const view = await getActiveRoutine(userId);
  const since14 = new Date(now.getTime() - 14 * 86_400_000);
  const [weights, sessions, lifts, records, pain] = await Promise.all([
    weightSeries(userId),
    db
      .select({ startedAt: workoutSession.startedAt, effort: workoutSession.effort })
      .from(workoutSession)
      .where(and(eq(workoutSession.userId, userId), eq(workoutSession.status, 'completed'), gte(workoutSession.startedAt, new Date(now.getTime() - 56 * 86_400_000))))
      .orderBy(desc(workoutSession.startedAt)),
    mainLifts(userId, view),
    db.select({ id: personalRecord.id }).from(personalRecord).where(and(eq(personalRecord.userId, userId), gte(personalRecord.achievedAt, since14))),
    painExercisesSince(userId, since14),
  ]);
  const trend = ema(weights.raw);
  const lastTrend = trend[trend.length - 1]?.value ?? null;
  const slope = weeklySlope(trend, 14, now);
  const weighIns14d = weights.raw.filter((w) => Date.parse(`${w.date}T12:00:00Z`) >= since14.getTime()).length;
  const planned = view?.days.length ?? 0;
  const adherenceWeeks = weeklyAdherence(sessions.map((s) => s.startedAt.toISOString()), planned, 4, now);
  // La semana en curso aún no termina, y las semanas anteriores al inicio de la rutina no cuentan.
  const startedOn = view?.startedOn ?? null;
  const closed = adherenceWeeks.slice(0, -1).filter((w) => startedOn !== null && w.weekStart >= startedOn);
  const avgPct = closed.length > 0 ? closed.reduce((a, w) => a + w.pct, 0) / closed.length : null;
  const recent = sessions.filter((s) => s.startedAt >= since14);
  const efforts = recent.map((s) => s.effort).filter((e): e is number => e !== null);
  const improving = lifts
    .map((l) => {
      const sorted = [...l.points].sort((a, b) => a.date.localeCompare(b.date));
      const first = sorted[0]?.score;
      const last = sorted[sorted.length - 1]?.score;
      return first && last && sorted.length >= 2 ? { id: l.id, name: l.name, changePct: Math.round(((last - first) / first) * 1000) / 10 } : null;
    })
    .filter((x): x is { id: string; name: string; changePct: number } => x !== null && x.changePct > 0);
  const thisWeekStart = currentWeekBounds(now).start;
  const triggers = detectTriggers(
    {
      goal,
      weights: weights.raw,
      mainLifts: lifts.map((l) => ({ exerciseId: l.id, points: l.points })),
      plannedPerWeek: planned,
      completedThisWeek: sessions.filter((s) => s.startedAt >= thisWeekStart).length,
      weekdayIndex: weekdayIndex(now),
      efforts,
      painReported: false,
    },
    now,
  );
  return {
    weight: {
      last: weights.raw[weights.raw.length - 1]?.value ?? null,
      trend: lastTrend,
      slopeKgPerWeek: weighIns14d >= 3 ? slope : null,
      slopePctPerWeek: weighIns14d >= 3 && slope !== null && lastTrend ? Math.round((slope / lastTrend) * 10000) / 100 : null,
      weighIns14d,
      expected: expectedWeeklyChangePct(goal),
    },
    adherence: { weeks: adherenceWeeks, avgPct: avgPct === null ? null : Math.round(avgPct * 100) / 100, plannedPerWeek: planned },
    sessions: { count14d: recent.length, avgEffort: efforts.length ? Math.round((efforts.reduce((a, b) => a + b, 0) / efforts.length) * 10) / 10 : null },
    stagnant: lifts.filter((l) => isStagnant(l.points, 3, now)).map((l) => ({ id: l.id, name: l.name })),
    improving,
    records14d: records.length,
    painExercises: pain,
    triggers,
  };
}

/** Disparadores automáticos (tarea diaria y al terminar sesión): abre revisiones adelantadas nuevas. */
export async function detectAndOpenEarlyCheckins(userId: string): Promise<{ id: string; trigger: EarlyTrigger }[]> {
  const metrics = await computeMetrics(userId);
  const opened: { id: string; trigger: EarlyTrigger }[] = [];
  for (const t of metrics.triggers) {
    const before = await getDb()
      .select({ id: checkin.id })
      .from(checkin)
      .where(and(eq(checkin.userId, userId), eq(checkin.type, 'early'), eq(checkin.trigger, t.trigger), gte(checkin.createdAt, new Date(Date.now() - 7 * 86_400_000))))
      .limit(1);
    // Una adelantada por disparador por semana, aunque se haya completado o descartado.
    if (before.length > 0) continue;
    const id = await triggerEarlyCheckin(userId, t.trigger, { detail: t.detail });
    if (id) opened.push({ id, trigger: t.trigger });
  }
  return opened;
}

// ── Análisis ──────────────────────────────────────────────────────────────────────────────

export type StoredProposal = Adjustment & { fromName?: string | null; toName?: string | null };

const RULES = [
  '- volume: cambia series de un grupo muscular (muscle = uno de los grupos listados o "accessories"), setsDelta entre −4 y +4.',
  '- deload: una semana con −10% de carga y una serie menos; solo con fatiga, sueño o energía bajos, o rendimiento a la baja.',
  '- swap_exercise: fromExercise = código E del ejercicio actual; toExercise = uno de sus sustitutos S listados. Úsalo con dolor o estancamiento de 3 semanas.',
  '- rest: alarga descansos 15 s cuando el rendimiento cae dentro de la sesión.',
  '- calories: kcalDelta entre −300 y +300 solo si la tendencia de peso (no un pesaje) salió del rango esperado y hay al menos 3 pesajes en 14 días.',
  '- keep: si todo va en rango.',
  `Grupos musculares válidos: ${MuscleGroup.options.join(', ')}.`,
].join('\n');

async function routineContext(userId: string, view: RoutineView) {
  const profileRow = await getProfile(userId);
  const q = completeAnswers(readAnswers(profileRow));
  const gym = await getActiveGymProfile(userId);
  const screeningRow = await latestScreening(userId);
  if (!q) return null;
  const cap = ((screeningRow?.intensityCap as IntensityCap | null) ?? evaluateScreening(q.safety).intensityCap) as IntensityCap;
  const ctx = buildContext(q, cap, gym);
  const catalog = await loadCatalogExercises(getDb());
  const byId = new Map(catalog.map((e) => [e.id, e]));
  const routineIds = [...new Set(view.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)))];
  const alternatives = new Map(
    routineIds.map((id) => {
      const ex = byId.get(id);
      return [id, ex ? alternativesFor(ex, catalog, ctx, { limit: 4 }).filter((a) => !routineIds.includes(a.id)) : []];
    }),
  );
  return { ctx, byId, routineIds, alternatives };
}

export function viewToPlan(view: RoutineView): RoutinePlan {
  return {
    rationale: view.version.rationale ?? '',
    days: view.days.map((d) => ({
      name: d.name,
      exercises: d.exercises.map((e) => ({
        exerciseId: e.exerciseId,
        sets: e.sets,
        repMin: e.repMin,
        repMax: e.repMax,
        targetSeconds: e.targetSeconds,
        rirTarget: e.rirTarget,
        restSeconds: e.restSeconds,
        ...(e.notes ? { notes: e.notes } : {}),
      })),
    })),
  };
}

/** Guarda respuestas, calcula métricas y obtiene propuestas (LLM dentro de reglas, o deterministas). */
export async function analyzeCheckin(userId: string, id: string, rawAnswers: unknown) {
  const row = await getCheckin(userId, id);
  if (!row) throw new Error('Revisión no encontrada.');
  if (row.completedAt) throw new Error('Esta revisión ya se cerró.');
  const answers = CheckinAnswers.parse(rawAnswers);
  const today = localDateString();

  if (answers.weightKg !== null || answers.measurements) {
    const m = answers.measurements;
    await addMeasurement(userId, {
      measuredAt: today,
      weightKg: answers.weightKg,
      neckCm: m?.neckCm ?? null,
      waistCm: m?.waistCm ?? null,
      hipCm: m?.hipCm ?? null,
      armCm: m?.armCm ?? null,
      thighCm: m?.thighCm ?? null,
      source: 'checkin',
    });
  }

  const metrics = await computeMetrics(userId);
  const view = await getActiveRoutine(userId);
  const [p] = await getDb().select({ goal: profile.goal }).from(profile).where(eq(profile.userId, userId));
  const goal = (p?.goal ?? 'hypertrophy') as Goal;
  const rc = view ? await routineContext(userId, view) : null;

  const triggers = [...new Set([...(row.trigger ? [row.trigger] : []), ...metrics.triggers.map((t) => t.trigger)])];
  if (row.trigger === 'pain' && answers.painPersists === false) triggers.splice(triggers.indexOf('pain'), 1);
  const named = (list: { id: string; name: string }[]) =>
    list.map((x) => {
      const alt = rc?.alternatives.get(x.id)?.[0] ?? null;
      return { id: x.id, name: x.name, alternativeId: alt?.id ?? null, alternativeName: alt?.nameEs ?? null };
    });
  const painInRoutine = rc ? metrics.painExercises.filter((x) => rc.routineIds.includes(x.id)) : [];

  // Escala 1–5 del formulario → mismas señales que usan las reglas.
  const fallback = deterministicProposals({
    triggers: answers.painPersists === false ? triggers.filter((t) => t !== 'pain') : triggers,
    type: row.type as CheckinType,
    goal,
    adherencePct: metrics.adherence.plannedPerWeek > 0 && metrics.adherence.avgPct !== null ? metrics.adherence.avgPct : 1,
    avgEffort: metrics.sessions.avgEffort,
    energy: answers.energy,
    sleep: answers.sleep,
    weightSlopePctPerWeek: metrics.weight.slopePctPerWeek,
    expectedRange: metrics.weight.slopePctPerWeek !== null ? metrics.weight.expected : null,
    stagnantExercises: named(metrics.stagnant),
    painExercises: answers.painPersists === false ? [] : named(painInRoutine),
  });

  let summary = fallback.summary;
  let adjustments: Adjustment[] = fallback.adjustments;
  let generator: 'llm' | 'rules' = 'rules';
  let aiMessage: string | null = null;

  if (view && rc) {
    const codeToId = new Map<string, string>();
    const lines: string[] = [];
    rc.routineIds.forEach((exId, i) => {
      const code = `E${i + 1}`;
      codeToId.set(code, exId);
      const ex = rc.byId.get(exId);
      const alts = rc.alternatives.get(exId) ?? [];
      const altText = alts
        .map((a, j) => {
          const altCode = `S${i + 1}.${j + 1}`;
          codeToId.set(altCode, a.id);
          return `${altCode} ${a.nameEs}`;
        })
        .join('; ');
      lines.push(`${code} | ${ex?.nameEs ?? exId} | ${ex?.pattern ?? ''}${altText ? ` | sustitutos: ${altText}` : ''}`);
    });
    const promptMetrics = {
      ...metrics,
      stagnant: metrics.stagnant.map((s) => [...codeToId.entries()].find(([, v]) => v === s.id)?.[0] ?? s.name),
      painExercises: painInRoutine.map((s) => [...codeToId.entries()].find(([, v]) => v === s.id)?.[0] ?? s.name),
      improving: metrics.improving.map((s) => ({ code: [...codeToId.entries()].find(([, v]) => v === s.id)?.[0] ?? s.name, changePct: s.changePct })),
    };
    const { notes, ...structured } = answers;
    const rendered = checkinPrompt.render({
      type: row.type,
      trigger: row.trigger ? (TRIGGER_LABELS_ES[row.trigger as EarlyTrigger] ?? row.trigger) : null,
      goal,
      metrics: promptMetrics,
      answers: structured,
      notes,
      rules: RULES,
      exerciseLines: lines,
    });
    const result = await runAi({
      fn: 'checkin_summary',
      userId,
      schema: CheckinAnalysis,
      system: rendered.system,
      prompt: rendered.prompt,
      promptId: checkinPrompt.id,
      promptVersion: checkinPrompt.version,
    });
    if (result.ok) {
      const valid: Adjustment[] = [];
      for (const a of result.output.adjustments) {
        if (a.kind === 'swap_exercise') {
          const from = a.fromExercise ? codeToId.get(a.fromExercise) : undefined;
          const to = a.toExercise ? codeToId.get(a.toExercise) : undefined;
          if (!from || !to || !rc.routineIds.includes(from) || !(rc.alternatives.get(from) ?? []).some((x) => x.id === to)) continue;
          valid.push({ ...a, fromExercise: from, toExercise: to });
        } else if (a.kind === 'volume') {
          if (!a.setsDelta || !a.muscle || !(a.muscle === 'accessories' || MuscleGroup.safeParse(a.muscle).success)) continue;
          valid.push({ ...a, fromExercise: null, toExercise: null, kcalDelta: null });
        } else if (a.kind === 'calories') {
          if (!a.kcalDelta || metrics.weight.slopePctPerWeek === null) continue;
          valid.push({ ...a, muscle: null, setsDelta: null, fromExercise: null, toExercise: null });
        } else {
          valid.push({ ...a, muscle: null, setsDelta: null, fromExercise: null, toExercise: null, kcalDelta: null });
        }
      }
      if (valid.length > 0) {
        summary = result.output.summary;
        adjustments = valid;
        generator = 'llm';
      }
    } else {
      aiMessage = result.message;
    }
  }

  const proposals: StoredProposal[] = adjustments.map((a) => ({
    ...a,
    fromName: a.fromExercise ? (rc?.byId.get(a.fromExercise)?.nameEs ?? null) : null,
    toName: a.toExercise ? (rc?.byId.get(a.toExercise)?.nameEs ?? null) : null,
  }));
  await getDb()
    .update(checkin)
    .set({
      answers: answers as unknown as Record<string, unknown>,
      metrics: { ...(metrics as unknown as Record<string, unknown>), generator, aiMessage },
      aiSummary: summary,
      proposedChanges: proposals,
    })
    .where(and(eq(checkin.userId, userId), eq(checkin.id, id)));
  return { summary, proposals, generator, aiMessage };
}

// ── Decisión ──────────────────────────────────────────────────────────────────────────────

const DecisionItem = z.object({
  index: z.number().int().min(0).max(9),
  accept: z.boolean(),
  /** Edición del usuario: series (volumen) o kcal (calorías). */
  setsDelta: z.number().int().min(-4).max(4).nullable().optional(),
  kcalDelta: z.number().int().min(-300).max(300).nullable().optional(),
});
export const CheckinDecision = z.object({ items: z.array(DecisionItem).max(10) });

/** El usuario acepta, edita o rechaza cada ajuste; los aceptados que tocan la rutina crean una versión nueva. */
export async function decideCheckin(userId: string, id: string, rawDecision: unknown) {
  const row = await getCheckin(userId, id);
  if (!row) throw new Error('Revisión no encontrada.');
  if (row.completedAt) throw new Error('Esta revisión ya se cerró.');
  const decision = CheckinDecision.parse(rawDecision);
  const proposals = row.proposedChanges as StoredProposal[];
  const accepted: StoredProposal[] = [];
  const rejected: StoredProposal[] = [];
  proposals.forEach((p, i) => {
    const d = decision.items.find((x) => x.index === i);
    if (!d?.accept) {
      rejected.push(p);
      return;
    }
    accepted.push({
      ...p,
      ...(p.kind === 'volume' && d.setsDelta !== undefined && d.setsDelta !== null ? { setsDelta: d.setsDelta } : {}),
      ...(p.kind === 'calories' && d.kcalDelta !== undefined && d.kcalDelta !== null ? { kcalDelta: d.kcalDelta } : {}),
    });
  });

  let routineVersionId: string | null = null;
  let version: number | null = null;
  if (changesRoutine(accepted)) {
    const view = await getActiveRoutine(userId);
    if (view) {
      const catalog = await loadCatalogExercises(getDb());
      const byId = new Map(catalog.map((e) => [e.id, e]));
      const plan = applyAdjustments(viewToPlan(view), accepted, byId);
      const saved = await saveRoutinePlan(userId, plan, {
        author: 'user',
        gymProfileId: view.gymProfileId,
        meta: { source: 'checkin', checkinId: id, previousVersionId: view.version.id },
        rationale: plan.rationale,
      });
      routineVersionId = saved.versionId;
      version = saved.version;
    }
  }

  const db = getDb();
  await db
    .update(checkin)
    .set({ completedAt: new Date(), decision: { accepted, rejected, routineVersionId, version, decidedAt: new Date().toISOString() } })
    .where(and(eq(checkin.userId, userId), eq(checkin.id, id)));

  // Reprograma la siguiente revisión del mismo tipo (la completa también cuenta como ligera).
  const settings = await getCheckinSettings(userId);
  const today = localDateString();
  if (row.type !== 'early') {
    const next = nextCheckinDates(settings.mode as CheckinMode, today, row.type === 'full' ? today : await lastCompleted(userId, 'full'), today);
    await db
      .update(checkinSettings)
      .set({ nextLightAt: next.light, ...(row.type === 'full' ? { nextFullAt: next.full } : {}), updatedAt: new Date() })
      .where(eq(checkinSettings.userId, userId));
  }
  return { accepted, rejected, routineVersionId, version };
}

/** Ajuste calórico acumulado de las revisiones aceptadas desde una fecha (lo usa Nutrición). */
export async function acceptedKcalAdjustments(userId: string, since: Date | null): Promise<number> {
  const rows = await getDb()
    .select({ decision: checkin.decision, completedAt: checkin.completedAt })
    .from(checkin)
    .where(and(eq(checkin.userId, userId), since ? gte(checkin.completedAt, since) : undefined));
  let total = 0;
  for (const r of rows) {
    const accepted = (r.decision as { accepted?: StoredProposal[] }).accepted ?? [];
    for (const a of accepted) if (a.kind === 'calories' && a.kcalDelta) total += a.kcalDelta;
  }
  return Math.max(-500, Math.min(500, total));
}

export function nextDueLabel(settings: { nextLightAt: string | null; nextFullAt: string | null }) {
  const dates = [settings.nextLightAt, settings.nextFullAt].filter((d): d is string => d !== null).sort();
  return dates[0] ?? addDays(localDateString(), 7);
}

