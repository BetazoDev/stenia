import type { Db } from '@stenia/db';
import { z } from 'zod';

import { loadEquipmentIds, newSummary, replaceMedia, upsertExercise, type ImportOptions, type ImportSummary, type MediaInput } from '../catalog';
import { inferCategory, inferLoadType, inferPattern, normalizeLevel } from '../classify';
import { mapFreeExerciseDbEquipment } from '../equipment-map';
import { normalizeMuscles } from '../muscles';
import { slugify } from '../slug';

export const FREE_EXERCISE_DB_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
export const FREE_EXERCISE_DB_IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
export const FREE_EXERCISE_DB_ATTRIBUTION = 'https://github.com/yuhonas/free-exercise-db';

export const FreeExerciseRow = z.object({
  id: z.string(),
  name: z.string(),
  force: z.string().nullable(),
  level: z.string(),
  mechanic: z.string().nullable(),
  equipment: z.string().nullable(),
  primaryMuscles: z.array(z.string()),
  secondaryMuscles: z.array(z.string()),
  instructions: z.array(z.string()),
  category: z.string(),
  images: z.array(z.string()),
});
export type FreeExerciseRow = z.infer<typeof FreeExerciseRow>;

const SOURCE = 'free-exercise-db';

export async function importFreeExerciseDb(db: Db, rawRows: unknown[], options: ImportOptions): Promise<ImportSummary> {
  const summary = newSummary();
  const equipmentIds = await loadEquipmentIds(db);
  const rows = rawRows.map((r) => FreeExerciseRow.parse(r));
  const subset = options.limit ? rows.slice(0, options.limit) : rows;

  let done = 0;
  for (const row of subset) {
    const slug = `fed-${slugify(row.id)}`;
    const bodyweight = row.equipment === 'body only' || row.equipment === null;
    const primaryMuscles = normalizeMuscles(row.primaryMuscles);
    const pattern = inferPattern({ name: row.name, mechanic: row.mechanic, category: row.category, primaryMuscles });
    const equipmentSlugs = mapFreeExerciseDbEquipment(row.equipment, row.name);
    const loadType = inferLoadType({ name: row.name, bodyweight, force: row.force, equipment: equipmentSlugs });

    const id = await upsertExercise(
      db,
      {
        slug,
        nameEs: row.name,
        nameEn: row.name,
        pattern,
        category: inferCategory({ loadType, pattern, bodyweight: loadType !== 'external' }),
        primaryMuscles,
        secondaryMuscles: normalizeMuscles(row.secondaryMuscles),
        loadType,
        level: normalizeLevel(row.level),
        mechanic: row.mechanic,
        force: row.force,
        instructionsEn: row.instructions,
        instructionsEs: [],
        meta: { originalCategory: row.category, originalEquipment: row.equipment },
        source: SOURCE,
        sourceId: row.id,
        license: 'Unlicense',
        attributionUrl: FREE_EXERCISE_DB_ATTRIBUTION,
        reviewed: false,
      },
      equipmentSlugs,
      equipmentIds,
      summary,
    );

    const media: MediaInput[] = row.images.slice(0, 2).map((path, index) => ({
      role: index === 0 ? 'start' : 'end',
      originUrl: `${FREE_EXERCISE_DB_IMAGE_BASE}${path}`,
      source: SOURCE,
      license: 'Unlicense',
      attributionUrl: FREE_EXERCISE_DB_ATTRIBUTION,
      sortOrder: index,
    }));
    await replaceMedia(db, id, slug, media, options, summary);
    options.log?.(`  ${SOURCE}: ${row.name}`);
    done += 1;
    await options.onProgress?.(done, subset.length);
  }
  return summary;
}
