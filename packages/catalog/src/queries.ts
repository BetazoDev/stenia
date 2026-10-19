import type { CatalogExercise, LoadType, MovementPattern, MuscleGroup, TrainingLevel } from '@stenia/core';
import { exercise, type Db } from '@stenia/db';
import { eq, sql } from 'drizzle-orm';

/** Catálogo activo en la forma compacta de @stenia/core (filtro, plantilla, validador y prompts). */
export async function loadCatalogExercises(db: Db): Promise<CatalogExercise[]> {
  const rows = await db
    .select({
      id: exercise.id,
      slug: exercise.slug,
      nameEs: exercise.nameEs,
      nameEn: exercise.nameEn,
      pattern: exercise.pattern,
      category: exercise.category,
      loadType: exercise.loadType,
      level: exercise.level,
      mechanic: exercise.mechanic,
      primaryMuscles: exercise.primaryMuscles,
      secondaryMuscles: exercise.secondaryMuscles,
      source: exercise.source,
      reviewed: exercise.reviewed,
      // Alias explícitos: Drizzle no califica las columnas interpoladas dentro de subconsultas.
      equipment: sql<string[]>`coalesce((select array_agg(q.slug order by q.slug) from exercise_equipment ee join equipment q on q.id = ee.equipment_id where ee.exercise_id = "exercise"."id" and ee.required), '{}')`,
      hasMedia: sql<boolean>`exists(select 1 from exercise_media m where m.exercise_id = "exercise"."id")`,
    })
    .from(exercise)
    .where(eq(exercise.active, true));
  return rows.map((r) => ({
    ...r,
    pattern: r.pattern as MovementPattern,
    loadType: r.loadType as LoadType,
    level: r.level as TrainingLevel,
    primaryMuscles: r.primaryMuscles as MuscleGroup[],
    secondaryMuscles: r.secondaryMuscles as MuscleGroup[],
    equipment: Array.isArray(r.equipment) ? r.equipment : [],
    hasMedia: Boolean(r.hasMedia),
  }));
}
