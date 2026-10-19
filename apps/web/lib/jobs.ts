import 'server-only';

import { Translations, translationPrompt } from '@stenia/ai';
import { importAllCatalogs, importUsdaFoods, translateExerciseName } from '@stenia/catalog';
import { normalizeText } from '@stenia/core';
import { exercise, food, job } from '@stenia/db';
import { and, asc, desc, eq, gte, sql } from 'drizzle-orm';
import { after } from 'next/server';

import { runAi } from './ai';
import { getDb } from './db';
import { invalidateCatalogCache } from './exercises';

/** Tareas largas lanzadas desde Configuración de desarrollador; corren después de responder (after()). */
export const JOB_TYPES = {
  import_foods: 'Importar alimentos USDA',
  import_exercises: 'Importar catálogo de ejercicios',
  translate_exercises_glossary: 'Traducir ejercicios con glosario',
  translate_exercises_ai: 'Refinar nombres de ejercicios con IA',
  translate_foods_ai: 'Refinar nombres de alimentos con IA',
} as const;
export type JobType = keyof typeof JOB_TYPES;

type Update = (progress: number, total: number, message?: string) => Promise<void>;

async function runJob(id: string, runner: (update: Update) => Promise<string>) {
  const db = getDb();
  const update: Update = async (progress, total, message) => {
    await db.update(job).set({ progress, total, ...(message ? { message } : {}) }).where(eq(job.id, id));
  };
  try {
    const message = await runner(update);
    await db.update(job).set({ status: 'done', message, finishedAt: new Date() }).where(eq(job.id, id));
  } catch (error) {
    await db
      .update(job)
      .set({ status: 'error', message: (error instanceof Error ? error.message : 'Error desconocido').slice(0, 500), finishedAt: new Date() })
      .where(eq(job.id, id));
  }
}

const AI_BATCH = 60;
const AI_MAX_PER_JOB = 600;

async function translateWithAi(kind: 'food' | 'exercise', userId: string, update: Update): Promise<string> {
  const db = getDb();
  const rows =
    kind === 'food'
      ? await db
          .select({ id: food.id, en: food.nameEn })
          .from(food)
          .where(and(eq(food.source, 'usda'), eq(food.nameReviewed, false), sql`not (${food.tags} @> '["name:ai"]'::jsonb)`))
          .orderBy(sql`length(${food.nameEn})`)
          .limit(AI_MAX_PER_JOB)
      : await db
          .select({ id: exercise.id, en: exercise.nameEn })
          .from(exercise)
          .where(and(eq(exercise.reviewed, false), sql`coalesce((${exercise.meta} ->> 'nameAi')::boolean, false) = false`))
          .orderBy(asc(exercise.nameEn))
          .limit(AI_MAX_PER_JOB);
  const items = rows.filter((r): r is { id: string; en: string } => Boolean(r.en));
  let done = 0;
  for (let i = 0; i < items.length; i += AI_BATCH) {
    const batch = items.slice(i, i + AI_BATCH);
    const keyToId = new Map(batch.map((b, k) => [`k${k}`, b.id]));
    const rendered = translationPrompt.render({ kind, items: batch.map((b, k) => ({ key: `k${k}`, en: b.en })) });
    const result = await runAi({
      fn: 'translation',
      userId,
      schema: Translations,
      system: rendered.system,
      prompt: rendered.prompt,
      promptId: translationPrompt.id,
      promptVersion: translationPrompt.version,
    });
    if (!result.ok) throw new Error(result.message);
    for (const t of result.output.items) {
      const id = keyToId.get(t.key);
      const es = t.es.trim();
      if (!id || es.length < 2) continue;
      const en = batch.find((b) => b.id === id)?.en ?? '';
      if (kind === 'food') {
        await db
          .update(food)
          .set({ nameEs: es, searchText: normalizeText(`${es} ${en}`), tags: sql`${food.tags} || '["name:ai"]'::jsonb` })
          .where(eq(food.id, id));
      } else {
        await db
          .update(exercise)
          .set({ nameEs: es, searchText: normalizeText(`${es} ${en}`), meta: sql`coalesce(${exercise.meta}, '{}'::jsonb) || '{"nameAi": true}'::jsonb`, updatedAt: new Date() })
          .where(eq(exercise.id, id));
      }
    }
    done += batch.length;
    await update(done, items.length);
  }
  if (kind === 'exercise') invalidateCatalogCache();
  return items.length === 0 ? 'No quedaban nombres por refinar.' : `Se refinaron ${done} nombres${items.length === AI_MAX_PER_JOB ? ' (vuelve a lanzarla para continuar)' : ''}.`;
}

const RUNNERS: Record<JobType, (userId: string, update: Update) => Promise<string>> = {
  import_foods: async (_userId, update) => {
    const r = await importUsdaFoods(getDb(), { onProgress: (d, t) => update(d, t) });
    return `${r.foods} alimentos importados o actualizados.`;
  },
  import_exercises: async (_userId, update) => {
    const summary = await importAllCatalogs(getDb(), { onProgress: (source, d, t) => update(d, t, `${source}: ${d}/${t}`) });
    invalidateCatalogCache();
    const all = Object.values(summary);
    return `${all.reduce((a, x) => a + x.exercises, 0)} ejercicios y ${all.reduce((a, x) => a + x.media, 0)} imágenes.`;
  },
  translate_exercises_glossary: async (_userId, update) => {
    const db = getDb();
    const rows = await db
      .select({ id: exercise.id, en: exercise.nameEn, es: exercise.nameEs })
      .from(exercise)
      .where(and(eq(exercise.reviewed, false), sql`coalesce((${exercise.meta} ->> 'nameAi')::boolean, false) = false`));
    let changed = 0;
    for (const [i, r] of rows.entries()) {
      const es = translateExerciseName(r.en);
      if (es !== r.es) {
        await db.update(exercise).set({ nameEs: es, searchText: normalizeText(`${es} ${r.en}`), updatedAt: new Date() }).where(eq(exercise.id, r.id));
        changed += 1;
      }
      if (i % 100 === 0) await update(i, rows.length);
    }
    await update(rows.length, rows.length);
    invalidateCatalogCache();
    return `${changed} de ${rows.length} nombres actualizados.`;
  },
  translate_exercises_ai: (userId, update) => translateWithAi('exercise', userId, update),
  translate_foods_ai: (userId, update) => translateWithAi('food', userId, update),
};

export async function startJob(type: JobType, userId: string): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const db = getDb();
  const [running] = await db
    .select({ id: job.id })
    .from(job)
    .where(and(eq(job.type, type), eq(job.status, 'running'), gte(job.startedAt, new Date(Date.now() - 30 * 60 * 1000))))
    .limit(1);
  if (running) return { ok: false, message: 'Esa tarea ya está corriendo.' };
  const [row] = await db.insert(job).values({ type, createdBy: userId, message: 'En cola' }).returning({ id: job.id });
  if (!row) return { ok: false, message: 'No se pudo crear la tarea.' };
  after(() => runJob(row.id, (update) => RUNNERS[type](userId, update)));
  return { ok: true, id: row.id };
}

export async function listJobs(limit = 12) {
  return getDb().select().from(job).orderBy(desc(job.startedAt)).limit(limit);
}

export async function catalogCounts() {
  const db = getDb();
  const [foods] = await db
    .select({
      total: sql<number>`count(*)::int`,
      usda: sql<number>`count(*) filter (where ${food.source} = 'usda')::int`,
      off: sql<number>`count(*) filter (where ${food.source} = 'off')::int`,
      reviewed: sql<number>`count(*) filter (where ${food.nameReviewed})::int`,
      ai: sql<number>`count(*) filter (where ${food.tags} @> '["name:ai"]'::jsonb)::int`,
    })
    .from(food);
  const [exercises] = await db
    .select({
      total: sql<number>`count(*)::int`,
      reviewed: sql<number>`count(*) filter (where ${exercise.reviewed})::int`,
      english: sql<number>`count(*) filter (where ${exercise.nameEs} = ${exercise.nameEn})::int`,
    })
    .from(exercise);
  return { foods, exercises };
}
