import 'server-only';

import { loadCatalogExercises } from '@stenia/catalog';
import { ALWAYS_AVAILABLE, alternativesFor, normalizeText, type CatalogExercise } from '@stenia/core';
import { equipment, exercise, exerciseEquipment, exerciseMedia, exerciseProgression, exerciseTip } from '@stenia/db';
import { and, asc, eq, inArray } from 'drizzle-orm';

import { getDb } from './db';
import { getActiveGymProfile } from './gym';
import { buildContext } from './routine';
import { exerciseHistory, setText, type MediaSet } from './session-data';
import { completeAnswers, getProfile, latestScreening, readAnswers } from './profile';

type CatalogCache = { at: number; list: CatalogExercise[]; byId: Map<string, CatalogExercise>; media: Map<string, MediaSet> };
const holder = globalThis as unknown as { __steniaCatalog?: CatalogCache };
const TTL_MS = 10 * 60 * 1000;

/** Catálogo en memoria (≈2 200 ejercicios) para buscar y filtrar sin ir a la base en cada tecla. */
export async function getCatalogCached(): Promise<CatalogCache> {
  const cached = holder.__steniaCatalog;
  if (cached && Date.now() - cached.at < TTL_MS) return cached;
  const db = getDb();
  const list = await loadCatalogExercises(db);
  const mediaRows = await db
    .select({ exerciseId: exerciseMedia.exerciseId, role: exerciseMedia.role, url: exerciseMedia.url, source: exerciseMedia.source, attributionUrl: exerciseMedia.attributionUrl })
    .from(exerciseMedia)
    .orderBy(asc(exerciseMedia.sortOrder));
  const media = new Map<string, MediaSet>();
  for (const r of mediaRows) {
    const m = media.get(r.exerciseId) ?? { start: null, end: null, main: null, source: r.source, attributionUrl: r.attributionUrl };
    if (r.role === 'start' && !m.start) m.start = r.url;
    else if (r.role === 'end' && !m.end) m.end = r.url;
    else if (r.role === 'main' && !m.main) m.main = r.url;
    media.set(r.exerciseId, m);
  }
  const next = { at: Date.now(), list, byId: new Map(list.map((e) => [e.id, e])), media };
  holder.__steniaCatalog = next;
  return next;
}

export function invalidateCatalogCache() {
  holder.__steniaCatalog = undefined;
}

export type CatalogFilters = { q?: string; pattern?: string; loadType?: string; available?: boolean; page?: number };

const PAGE_SIZE = 30;
const SOURCE_RANK: Record<string, number> = { repdb: 0, 'free-exercise-db': 1, calisthenics: 2 };

export async function searchCatalog(userId: string, filters: CatalogFilters) {
  const { list, media } = await getCatalogCached();
  const gym = filters.available ? await getActiveGymProfile(userId) : null;
  const available = new Set([...(gym?.equipment.map((e) => e.slug) ?? []), ...ALWAYS_AVAILABLE]);
  const terms = normalizeText(filters.q ?? '').split(' ').filter(Boolean);
  const results = list
    .filter((e) => e.pattern !== 'mobility' || filters.pattern === 'mobility')
    .filter((e) => !filters.pattern || e.pattern === filters.pattern)
    .filter((e) => !filters.loadType || e.loadType === filters.loadType)
    .filter((e) => !filters.available || e.equipment.every((q) => available.has(q)))
    .filter((e) => {
      if (terms.length === 0) return true;
      const hay = normalizeText(`${e.nameEs} ${e.nameEn}`);
      return terms.every((t) => hay.includes(t));
    })
    .sort((a, b) => {
      const qa = terms.length > 0 && normalizeText(a.nameEs).startsWith(terms[0] ?? '') ? 0 : 1;
      const qb = terms.length > 0 && normalizeText(b.nameEs).startsWith(terms[0] ?? '') ? 0 : 1;
      return qa - qb || Number(b.hasMedia) - Number(a.hasMedia) || (SOURCE_RANK[a.source] ?? 3) - (SOURCE_RANK[b.source] ?? 3) || a.nameEs.localeCompare(b.nameEs, 'es');
    });
  const page = Math.max(1, filters.page ?? 1);
  return {
    total: results.length,
    page,
    pages: Math.max(1, Math.ceil(results.length / PAGE_SIZE)),
    items: results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((e) => ({ ...e, media: media.get(e.id) ?? null })),
  };
}

export async function getExerciseDetail(userId: string, slug: string) {
  const db = getDb();
  const [row] = await db.select().from(exercise).where(eq(exercise.slug, slug)).limit(1);
  if (!row) return null;
  const [mediaRows, equipmentRows, nexts, prevs, tipRow, history, cache, gym, profileRow, screeningRow] = await Promise.all([
    db.select().from(exerciseMedia).where(eq(exerciseMedia.exerciseId, row.id)).orderBy(asc(exerciseMedia.sortOrder)),
    db
      .select({ slug: equipment.slug, nameEs: equipment.nameEs })
      .from(exerciseEquipment)
      .innerJoin(equipment, eq(equipment.id, exerciseEquipment.equipmentId))
      .where(eq(exerciseEquipment.exerciseId, row.id)),
    db
      .select({ id: exercise.id, slug: exercise.slug, name: exercise.nameEs, threshold: exerciseProgression.threshold })
      .from(exerciseProgression)
      .innerJoin(exercise, eq(exercise.id, exerciseProgression.toExerciseId))
      .where(eq(exerciseProgression.fromExerciseId, row.id)),
    db
      .select({ id: exercise.id, slug: exercise.slug, name: exercise.nameEs, threshold: exerciseProgression.threshold })
      .from(exerciseProgression)
      .innerJoin(exercise, eq(exercise.id, exerciseProgression.fromExerciseId))
      .where(eq(exerciseProgression.toExerciseId, row.id)),
    db.select().from(exerciseTip).where(and(eq(exerciseTip.userId, userId), eq(exerciseTip.exerciseId, row.id))).limit(1),
    exerciseHistory(userId, [row.id], 30),
    getCatalogCached(),
    getActiveGymProfile(userId),
    getProfile(userId),
    latestScreening(userId),
  ]);
  const media: MediaSet = { start: null, end: null, main: null, source: mediaRows[0]?.source ?? null, attributionUrl: mediaRows[0]?.attributionUrl ?? null };
  for (const m of mediaRows) {
    if (m.role === 'start' && !media.start) media.start = m.url;
    else if (m.role === 'end' && !media.end) media.end = m.url;
    else if (m.role === 'main' && !media.main) media.main = m.url;
  }
  const catalogEntry = cache.byId.get(row.id);
  const q = completeAnswers(readAnswers(profileRow));
  const ctx = q ? buildContext(q, (screeningRow?.intensityCap as never) ?? 'moderate', gym) : null;
  const alternatives = catalogEntry && ctx ? alternativesFor(catalogEntry, cache.list, ctx, { limit: 6 }) : [];
  const sessions = history.get(row.id) ?? [];
  const allSets = sessions.flatMap((s) => s.sets);
  const loadType = row.loadType;
  let bestE1rm: number | null = null;
  let bestText: string | null = null;
  for (const s of allSets) {
    const load = s.weightKg ?? s.addedWeightKg ?? 0;
    const reps = s.reps ?? 0;
    const e1 = load > 0 && reps > 0 && reps <= 12 ? Math.round(load * (1 + reps / 30) * 10) / 10 : null;
    if (e1 !== null && (bestE1rm === null || e1 > bestE1rm)) {
      bestE1rm = e1;
      bestText = setText(s, loadType);
    }
  }
  if (!bestText && allSets.length > 0) {
    const best = [...allSets].sort((a, b) => (b.seconds ?? 0) - (a.seconds ?? 0) || (b.reps ?? 0) - (a.reps ?? 0))[0];
    if (best) bestText = setText(best, loadType);
  }
  const available = new Set([...(gym?.equipment.map((e) => e.slug) ?? []), ...ALWAYS_AVAILABLE]);
  return {
    exercise: row,
    media,
    equipment: equipmentRows.map((e) => ({ ...e, available: available.has(e.slug) })),
    ladder: { previous: prevs[0] ?? null, next: nexts[0] ?? null },
    tip: tipRow[0] ?? null,
    alternatives: alternatives.map((a) => ({ ...a, media: cache.media.get(a.id) ?? null })),
    history: {
      sessions: sessions.length,
      bestText,
      bestE1rm,
      last: sessions[0] ? { date: sessions[0].date, sets: sessions[0].sets.map((s) => setText(s, loadType)) } : null,
    },
  };
}

export async function exercisesByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return getDb().select({ id: exercise.id, slug: exercise.slug, nameEs: exercise.nameEs }).from(exercise).where(inArray(exercise.id, ids));
}
