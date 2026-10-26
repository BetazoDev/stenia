import 'server-only';

import { AliasRoutinePlan, routinePrompt } from '@stenia/ai';
import { importAllCatalogs, loadCatalogExercises } from '@stenia/catalog';
import {
  DAY_SLOTS,
  GOAL_LABELS_ES,
  INJURY_ZONE_LABELS_ES,
  LEVEL_LABELS_ES,
  MIN_RIR_FOR_CAP,
  MUSCLE_LABELS_ES,
  WEEKLY_VOLUME,
  ageFromBirthDate,
  buildTemplatePlan,
  dayNames,
  evaluateScreening,
  filterCatalog,
  rankForSlot,
  slotsForDay,
  splitFor,
  splitList,
  trainingLevel,
  validateRoutinePlan,
  type CatalogExercise,
  type CompleteQuestionnaire,
  type GenerationContext,
  type IntensityCap,
  type RoutinePlan,
} from '@stenia/core';
import {
  exercise,
  exerciseMedia,
  routine,
  routineDay,
  routineExercise,
  routineVersion,
  workoutSession,
} from '@stenia/db';
import { and, asc, desc, eq, gt, inArray, ne } from 'drizzle-orm';

import { runAi } from './ai';
import { getDb } from './db';
import { localDateString } from './dates';
import { getActiveGymProfile, type GymProfileWithEquipment } from './gym';
import { completeAnswers, getProfile, latestScreening, readAnswers } from './profile';

export type GenerationStage = 'profile' | 'catalog' | 'choosing' | 'validating' | 'retry' | 'fallback' | 'saving' | 'done' | 'error';
export type GenerationEvent = { stage: GenerationStage; message: string; routineId?: string; generator?: 'llm' | 'template' };

export class GenerationError extends Error {}

/** Contexto determinista del generador a partir del cuestionario, el cribado y el equipamiento activo. */
export function buildContext(q: CompleteQuestionnaire, cap: IntensityCap, gym: GymProfileWithEquipment | null): GenerationContext {
  return {
    goal: q.goal.goal,
    level: trainingLevel(q.level),
    daysPerWeek: q.logistics.daysPerWeek,
    minutesPerSession: q.logistics.minutesPerSession,
    gymRatio: q.goal.gymRatio,
    skillGoals: q.goal.skillGoals,
    intensityCap: cap,
    injuryZones: q.injuries?.zones ?? [],
    painfulMovements: q.injuries?.painfulMovements ?? '',
    banned: splitList(q.recovery?.banned),
    favorites: splitList(q.recovery?.favorites),
    availableEquipment: (gym?.equipment ?? []).map((e) => e.slug),
  };
}


function catalogLine(code: string, ex: CatalogExercise): string {
  const muscles = ex.primaryMuscles.map((m) => MUSCLE_LABELS_ES[m] ?? m).join(', ');
  return `${code} | ${ex.nameEs}${ex.nameEs !== ex.nameEn ? ` (${ex.nameEn})` : ''} | ${ex.pattern} | ${muscles} | ${ex.loadType} | ${ex.level}`;
}

/** Candidatos por hueco (los 10 mejores de cada uno), deduplicados y con códigos cortos para el prompt. */
export function promptCatalog(catalog: CatalogExercise[], ctx: GenerationContext) {
  const candidates = filterCatalog(catalog, ctx);
  const split = splitFor(ctx.daysPerWeek, ctx.level, ctx.goal);
  const chosen = new Map<string, CatalogExercise>();
  for (const day of new Set(split.days)) {
    for (const slot of slotsForDay(day, ctx.skillGoals)) {
      for (const ex of rankForSlot(candidates, slot, ctx).slice(0, 10)) chosen.set(ex.id, ex);
    }
  }
  const list = [...chosen.values()];
  const codeToId = new Map<string, string>();
  const lines = list.map((ex, i) => {
    const code = `E${i + 1}`;
    codeToId.set(code, ex.id);
    return catalogLine(code, ex);
  });
  return { list, lines, codeToId, allowedIds: new Set(list.map((e) => e.id)) };
}

function focusOf(day: keyof typeof DAY_SLOTS): string {
  return DAY_SLOTS[day]
    .map((s) => (s.focus ? `aislamiento de ${s.focus.map((m) => MUSCLE_LABELS_ES[m]).join('/')}` : s.patterns.join('/')))
    .join(', ');
}

async function recentHistory(userId: string): Promise<string | null> {
  const db = getDb();
  const sessions = await db
    .select({ id: workoutSession.id })
    .from(workoutSession)
    .where(and(eq(workoutSession.userId, userId), eq(workoutSession.status, 'completed')))
    .orderBy(desc(workoutSession.startedAt))
    .limit(12);
  if (sessions.length === 0) return null;
  return `${sessions.length} sesiones completadas en las últimas semanas.`;
}

function mapAliases(plan: AliasRoutinePlan, codeToId: Map<string, string>): RoutinePlan {
  return {
    rationale: plan.rationale,
    days: plan.days.map((d) => ({
      name: d.name,
      exercises: d.exercises.map((e) => ({ ...e, exerciseId: codeToId.get(e.exerciseId.trim().toUpperCase()) ?? e.exerciseId })),
    })),
  };
}

export async function generateRoutine(userId: string, emit: (e: GenerationEvent) => void = () => undefined) {
  const db = getDb();
  emit({ stage: 'profile', message: 'Leyendo tu perfil' });
  const profileRow = await getProfile(userId);
  const q = completeAnswers(readAnswers(profileRow));
  if (!q) throw new GenerationError('Faltan bloques obligatorios del cuestionario (seguridad, datos corporales, objetivo y logística).');
  const screeningRow = await latestScreening(userId);
  const cap = ((screeningRow?.intensityCap as IntensityCap | null) ?? evaluateScreening(q.safety).intensityCap) as IntensityCap;
  const gym = await getActiveGymProfile(userId);
  if (!gym) throw new GenerationError('Configura tu equipamiento antes de generar la rutina.');
  const ctx = buildContext(q, cap, gym);

  let catalog = await loadCatalogExercises(db);
  if (catalog.length === 0) {
    emit({ stage: 'catalog', message: 'Preparando el catálogo de ejercicios (solo la primera vez)' });
    await importAllCatalogs(db, {
      onProgress: (source, done, total) => {
        if (done % 50 === 0 || done === total) emit({ stage: 'catalog', message: `Importando ${source}: ${done}/${total}` });
      },
    });
    catalog = await loadCatalogExercises(db);
  }
  if (catalog.length === 0) throw new GenerationError('El catálogo de ejercicios está vacío.');
  const byId = new Map(catalog.map((e) => [e.id, e]));

  emit({ stage: 'choosing', message: 'Eligiendo ejercicios' });
  const prompt = promptCatalog(catalog, ctx);
  const split = splitFor(ctx.daysPerWeek, ctx.level, ctx.goal);
  const names = dayNames(split.days);
  const { min, max } = WEEKLY_VOLUME[ctx.level];
  let plan: RoutinePlan | null = null;
  let generator: 'llm' | 'template' = 'template';
  let modelId: string | null = null;
  let warnings: string[] = [];
  let previousErrors: string[] = [];

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const rendered = routinePrompt.render({
      profile: {
        age: ageFromBirthDate(q.body.birthDate),
        sex: q.body.sex,
        heightCm: q.body.heightCm,
        weightKg: q.body.weightKg,
        level: LEVEL_LABELS_ES[ctx.level],
        goal: GOAL_LABELS_ES[ctx.goal],
        gymRatio: ctx.gymRatio,
        skillGoals: ctx.skillGoals,
        intensityCap: cap,
        minRir: MIN_RIR_FOR_CAP[cap],
        trainingMonths: q.level?.trainingMonths ?? null,
        marks: {
          flexiones: q.level?.maxPushups ?? null,
          dominadas: q.level?.maxPullups ?? null,
          fondos: q.level?.maxDips ?? null,
          planchaSeg: q.level?.plankSeconds ?? null,
          pressKg: q.level?.benchKg ?? null,
          sentadillaKg: q.level?.squatKg ?? null,
          remoKg: q.level?.rowKg ?? null,
        },
      },
      split: { label: split.label, days: split.days.map((d, i) => ({ name: names[i] ?? d, focus: focusOf(d) })) },
      minutesPerSession: ctx.minutesPerSession,
      repRules:
        ctx.goal === 'strength'
          ? 'fuerza 3–6 en compuestos principales, 5–8 secundarios, 8–12 accesorios'
          : 'hipertrofia 6–12 en compuestos, 10–15 en accesorios; calistenia por umbral (5–12 repeticiones) o segundos',
      restRules: 'compuesto pesado 120–180 s; accesorio 60–90 s; isométrico de habilidad 120–180 s',
      volumeRules: `${min}–${max} series semanales por grupo muscular, conservador al inicio`,
      injuries: ctx.injuryZones.map((z) => INJURY_ZONE_LABELS_ES[z]),
      painfulMovements: ctx.painfulMovements,
      favorites: q.recovery?.favorites ?? '',
      banned: q.recovery?.banned ?? '',
      history: await recentHistory(userId),
      catalogLines: prompt.lines,
      previousErrors,
    });
    const result = await runAi({
      fn: 'routine_generation',
      userId,
      schema: AliasRoutinePlan,
      system: rendered.system,
      prompt: rendered.prompt,
      promptId: routinePrompt.id,
      promptVersion: routinePrompt.version,
    });
    if (!result.ok) {
      if (result.reason !== 'error' || attempt === 2) break;
      previousErrors = [`La respuesta no se pudo leer: ${result.message}`];
      emit({ stage: 'retry', message: 'Reintentando con las correcciones' });
      continue;
    }
    emit({ stage: 'validating', message: 'Validando' });
    const mapped = mapAliases(result.output, prompt.codeToId);
    const validation = validateRoutinePlan(mapped, { ctx, catalogById: byId, allowedIds: prompt.allowedIds });
    if (validation.ok && validation.plan) {
      plan = validation.plan;
      generator = 'llm';
      modelId = result.modelId;
      warnings = validation.warnings;
      break;
    }
    previousErrors = validation.errors.map((e) => {
      // Devuelve los IDs reales a códigos para que el modelo entienda el error.
      let out = e;
      for (const [code, id] of prompt.codeToId) out = out.replaceAll(id, code);
      return out;
    });
    if (attempt < 2) emit({ stage: 'retry', message: `Corrigiendo ${validation.errors.length} problema(s)` });
  }

  if (!plan) {
    emit({ stage: 'fallback', message: 'Usando la plantilla determinista' });
    plan = buildTemplatePlan(catalog, ctx);
    const check = validateRoutinePlan(plan, { ctx, catalogById: byId, allowedIds: new Set(filterCatalog(catalog, ctx).map((e) => e.id)) });
    warnings = check.warnings;
  }

  emit({ stage: 'saving', message: 'Guardando la rutina' });
  const saved = await saveRoutinePlan(userId, plan, {
    author: 'ai',
    gymProfileId: gym.id,
    meta: { generator, modelId, warnings, split: split.key, intensityCap: cap, promptVersion: routinePrompt.version },
    resetBlock: true,
  });
  emit({ stage: 'done', message: 'Listo', routineId: saved.routineId, generator });
  return { ...saved, generator, warnings };
}

/** Crea una nueva versión inmutable de la rutina activa (o una rutina nueva si no hay). */
export async function saveRoutinePlan(
  userId: string,
  plan: RoutinePlan,
  options: { author: 'ai' | 'user'; gymProfileId?: string | null; meta?: Record<string, unknown>; resetBlock?: boolean; rationale?: string },
): Promise<{ routineId: string; versionId: string; version: number }> {
  const db = getDb();
  return db.transaction(async (tx) => {
    let [active] = await tx
      .select()
      .from(routine)
      .where(and(eq(routine.userId, userId), eq(routine.status, 'active')))
      .orderBy(desc(routine.updatedAt))
      .limit(1);
    if (!active) {
      [active] = await tx
        .insert(routine)
        .values({ userId, name: 'Mi rutina', status: 'active', gymProfileId: options.gymProfileId ?? null, startedOn: localDateString() })
        .returning();
    }
    if (!active) throw new GenerationError('No se pudo crear la rutina.');
    const [last] = await tx
      .select({ version: routineVersion.version })
      .from(routineVersion)
      .where(eq(routineVersion.routineId, active.id))
      .orderBy(desc(routineVersion.version))
      .limit(1);
    const version = (last?.version ?? 0) + 1;
    const [v] = await tx
      .insert(routineVersion)
      .values({ routineId: active.id, version, author: options.author, rationale: options.rationale ?? plan.rationale, meta: options.meta ?? {} })
      .returning({ id: routineVersion.id });
    if (!v) throw new GenerationError('No se pudo guardar la versión.');
    for (const [dayIndex, day] of plan.days.entries()) {
      const [d] = await tx.insert(routineDay).values({ routineVersionId: v.id, sortOrder: dayIndex, name: day.name }).returning({ id: routineDay.id });
      if (!d) continue;
      await tx.insert(routineExercise).values(
        day.exercises.map((e, i) => ({
          routineDayId: d.id,
          exerciseId: e.exerciseId,
          sortOrder: i,
          sets: e.sets,
          repMin: e.repMin,
          repMax: e.repMax,
          targetSeconds: e.targetSeconds,
          rirTarget: e.rirTarget,
          restSeconds: e.restSeconds,
          notes: e.notes ?? null,
        })),
      );
    }
    await tx
      .update(routine)
      .set({
        currentVersionId: v.id,
        gymProfileId: options.gymProfileId ?? active.gymProfileId,
        ...(options.resetBlock ? { startedOn: localDateString() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(routine.id, active.id));
    await tx.update(routine).set({ status: 'archived' }).where(and(eq(routine.userId, userId), ne(routine.id, active.id), eq(routine.status, 'active')));
    return { routineId: active.id, versionId: v.id, version };
  });
}

export type RoutineExerciseView = typeof routineExercise.$inferSelect & {
  exercise: {
    id: string;
    slug: string;
    nameEs: string;
    nameEn: string;
    loadType: string;
    pattern: string;
    primaryMuscles: string[];
    reviewed: boolean;
  };
  media: { role: string; url: string }[];
};

export type RoutineDayView = typeof routineDay.$inferSelect & { exercises: RoutineExerciseView[] };

export type RoutineView = typeof routine.$inferSelect & {
  version: typeof routineVersion.$inferSelect;
  days: RoutineDayView[];
};

export async function getRoutineVersionView(versionId: string): Promise<RoutineDayView[]> {
  const db = getDb();
  const days = await db.select().from(routineDay).where(eq(routineDay.routineVersionId, versionId)).orderBy(asc(routineDay.sortOrder));
  if (days.length === 0) return [];
  const items = await db
    .select({
      re: routineExercise,
      exercise: {
        id: exercise.id,
        slug: exercise.slug,
        nameEs: exercise.nameEs,
        nameEn: exercise.nameEn,
        loadType: exercise.loadType,
        pattern: exercise.pattern,
        primaryMuscles: exercise.primaryMuscles,
        reviewed: exercise.reviewed,
      },
    })
    .from(routineExercise)
    .innerJoin(exercise, eq(exercise.id, routineExercise.exerciseId))
    .where(inArray(routineExercise.routineDayId, days.map((d) => d.id)))
    .orderBy(asc(routineExercise.sortOrder));
  const exerciseIds = [...new Set(items.map((i) => i.exercise.id))];
  const media = exerciseIds.length
    ? await db
        .select({ exerciseId: exerciseMedia.exerciseId, role: exerciseMedia.role, url: exerciseMedia.url })
        .from(exerciseMedia)
        .where(inArray(exerciseMedia.exerciseId, exerciseIds))
        .orderBy(asc(exerciseMedia.sortOrder))
    : [];
  return days.map((d) => ({
    ...d,
    exercises: items
      .filter((i) => i.re.routineDayId === d.id)
      .map((i) => ({ ...i.re, exercise: i.exercise, media: media.filter((m) => m.exerciseId === i.exercise.id) })),
  }));
}

export async function getActiveRoutine(userId: string): Promise<RoutineView | null> {
  const db = getDb();
  const [r] = await db
    .select()
    .from(routine)
    .where(and(eq(routine.userId, userId), eq(routine.status, 'active')))
    .orderBy(desc(routine.updatedAt))
    .limit(1);
  if (!r?.currentVersionId) return null;
  const [version] = await db.select().from(routineVersion).where(eq(routineVersion.id, r.currentVersionId));
  if (!version) return null;
  return { ...r, version, days: await getRoutineVersionView(version.id) };
}

export async function listRoutineVersions(userId: string) {
  const db = getDb();
  return db
    .select({
      id: routineVersion.id,
      version: routineVersion.version,
      author: routineVersion.author,
      rationale: routineVersion.rationale,
      meta: routineVersion.meta,
      createdAt: routineVersion.createdAt,
      routineId: routine.id,
      current: routine.currentVersionId,
    })
    .from(routineVersion)
    .innerJoin(routine, eq(routine.id, routineVersion.routineId))
    .where(eq(routine.userId, userId))
    .orderBy(desc(routineVersion.createdAt));
}

/** Siguiente día de la rotación: el que sigue al último entrenado (desde el último «reiniciar semana/ciclo»). */
export async function nextRoutineDay(userId: string, view: RoutineView): Promise<RoutineDayView | null> {
  if (view.days.length === 0) return null;
  const db = getDb();
  const [last] = await db
    .select({ dayId: workoutSession.routineDayId })
    .from(workoutSession)
    .where(
      and(
        eq(workoutSession.userId, userId),
        eq(workoutSession.status, 'completed'),
        view.rotationResetAt ? gt(workoutSession.startedAt, view.rotationResetAt) : undefined,
      ),
    )
    .orderBy(desc(workoutSession.startedAt))
    .limit(1);
  if (!last?.dayId) return view.days[0] ?? null;
  const [lastDay] = await db.select({ sortOrder: routineDay.sortOrder }).from(routineDay).where(eq(routineDay.id, last.dayId));
  const index = lastDay ? (lastDay.sortOrder + 1) % view.days.length : 0;
  return view.days[index] ?? view.days[0] ?? null;
}
