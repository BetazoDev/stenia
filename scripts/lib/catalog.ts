import { eq, sql } from 'drizzle-orm';
import { equipment, exercise, exerciseEquipment, exerciseMedia, exerciseProgression, type Db, type ProgressionThreshold } from '@stenia/db';

import { fetchBytes } from './http';
import { contentTypeFor, extensionFor, type Mirror } from './r2';

export type ExerciseInput = Omit<typeof exercise.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;

export type MediaInput = {
  role: 'start' | 'end' | 'main';
  originUrl: string;
  source: string;
  license: string;
  attributionUrl: string;
  sortOrder: number;
};

export type ImportOptions = {
  mirror: Mirror | null;
  limit?: number | undefined;
  log?: ((message: string) => void) | undefined;
};

export type ImportSummary = {
  exercises: number;
  media: number;
  progressions: number;
  skippedEquipment: string[];
};

export async function loadEquipmentIds(db: Db): Promise<Map<string, string>> {
  const rows = await db.select({ id: equipment.id, slug: equipment.slug }).from(equipment);
  if (rows.length === 0) {
    throw new Error('La tabla equipment está vacía: ejecuta primero `pnpm db:seed`.');
  }
  return new Map(rows.map((r) => [r.slug, r.id]));
}

/** Inserta o actualiza un ejercicio por slug y sincroniza su equipo requerido. Devuelve el id. */
export async function upsertExercise(
  db: Db,
  input: ExerciseInput,
  equipmentSlugs: string[],
  equipmentIds: Map<string, string>,
  summary: ImportSummary,
): Promise<string> {
  const [row] = await db
    .insert(exercise)
    .values(input)
    .onConflictDoUpdate({
      target: exercise.slug,
      set: {
        nameEs: input.nameEs,
        nameEn: input.nameEn,
        pattern: input.pattern,
        category: input.category,
        primaryMuscles: input.primaryMuscles,
        secondaryMuscles: input.secondaryMuscles,
        loadType: input.loadType,
        level: input.level,
        mechanic: input.mechanic,
        force: input.force,
        descriptionEs: input.descriptionEs,
        descriptionEn: input.descriptionEn,
        instructionsEs: input.instructionsEs,
        instructionsEn: input.instructionsEn,
        cuesEs: input.cuesEs,
        meta: input.meta,
        license: input.license,
        attributionUrl: input.attributionUrl,
        updatedAt: new Date(),
      },
    })
    .returning({ id: exercise.id });
  if (!row) throw new Error(`No se pudo guardar el ejercicio ${input.slug}`);

  await db.delete(exerciseEquipment).where(eq(exerciseEquipment.exerciseId, row.id));
  const links = equipmentSlugs
    .map((slug) => {
      const id = equipmentIds.get(slug);
      if (!id && !summary.skippedEquipment.includes(slug)) summary.skippedEquipment.push(slug);
      return id ? { exerciseId: row.id, equipmentId: id, required: true } : null;
    })
    .filter((x): x is { exerciseId: string; equipmentId: string; required: boolean } => x !== null);
  if (links.length > 0) await db.insert(exerciseEquipment).values(links).onConflictDoNothing();

  summary.exercises += 1;
  return row.id;
}

/** Reemplaza los medios de un ejercicio; con espejo activo, sube cada imagen a R2 y guarda la URL pública. */
export async function replaceMedia(
  db: Db,
  exerciseId: string,
  slug: string,
  media: MediaInput[],
  options: ImportOptions,
  summary: ImportSummary,
): Promise<void> {
  await db.delete(exerciseMedia).where(eq(exerciseMedia.exerciseId, exerciseId));
  for (const m of media) {
    let url = m.originUrl;
    let storageKey: string | null = null;
    if (options.mirror) {
      try {
        const bytes = await fetchBytes(m.originUrl);
        const contentType = contentTypeFor(m.originUrl);
        storageKey = `exercises/${m.source}/${slug}/${m.role}-${m.sortOrder}.${extensionFor(contentType)}`;
        url = await options.mirror.put(storageKey, bytes, contentType);
      } catch (error) {
        options.log?.(`  ! sin espejo para ${m.originUrl}: ${error instanceof Error ? error.message : String(error)}`);
        storageKey = null;
        url = m.originUrl;
      }
    }
    await db.insert(exerciseMedia).values({
      exerciseId,
      type: 'image',
      role: m.role,
      url,
      storageKey,
      originUrl: m.originUrl,
      sortOrder: m.sortOrder,
      source: m.source,
      license: m.license,
      attributionUrl: m.attributionUrl,
    });
    summary.media += 1;
  }
}

export async function upsertProgression(
  db: Db,
  fromId: string,
  toId: string,
  threshold: ProgressionThreshold,
  source: string,
  summary: ImportSummary,
): Promise<void> {
  if (fromId === toId) return;
  await db
    .insert(exerciseProgression)
    .values({ fromExerciseId: fromId, toExerciseId: toId, threshold, source })
    .onConflictDoUpdate({
      target: [exerciseProgression.fromExerciseId, exerciseProgression.toExerciseId],
      set: { threshold, source },
    });
  summary.progressions += 1;
}

export async function findExerciseIdBySlug(db: Db, slug: string): Promise<string | null> {
  const [row] = await db.select({ id: exercise.id }).from(exercise).where(eq(exercise.slug, slug)).limit(1);
  return row?.id ?? null;
}

export async function countExercisesBySource(db: Db): Promise<Record<string, number>> {
  const rows = await db
    .select({ source: exercise.source, count: sql<number>`count(*)::int` })
    .from(exercise)
    .groupBy(exercise.source);
  return Object.fromEntries(rows.map((r) => [r.source, r.count]));
}

export function newSummary(): ImportSummary {
  return { exercises: 0, media: 0, progressions: 0, skippedEquipment: [] };
}
