import type { Db } from '@stenia/db';
import { z } from 'zod';

import { loadEquipmentIds, newSummary, replaceMedia, upsertExercise, type ImportOptions, type ImportSummary, type MediaInput } from '../lib/catalog';
import { inferCategory, inferLoadType, inferPattern, normalizeLevel } from '../lib/classify';
import { mapRepDbEquipment } from '../lib/equipment-map';
import { normalizeMuscles } from '../lib/muscles';
import { slugify } from '../lib/slug';

export const REPDB_URL = 'https://raw.githubusercontent.com/RepDB/exercise-dataset/main/exercises.json';
export const REPDB_IMAGE_BASE = 'https://raw.githubusercontent.com/RepDB/exercise-dataset/main/';
export const REPDB_ATTRIBUTION = 'https://repdb.co';
export const REPDB_LICENSE = 'RepDB Free (atribución visible obligatoria; sin redistribución)';
export const SOURCE = 'repdb';

export const RepDbRow = z.object({
  id: z.string(),
  name_en: z.string(),
  name_es: z.string().optional(),
  description_en: z.string().optional(),
  description_es: z.string().optional(),
  category: z.string(),
  force_type: z.string().nullable().optional(),
  mechanic: z.string().nullable().optional(),
  difficulty: z.string().optional(),
  equipment: z.string().nullable().optional(),
  body_part: z.string().optional(),
  primary_muscles: z.array(z.string()).default([]),
  secondary_muscles: z.array(z.string()).default([]),
  goals: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  is_unilateral: z.boolean().optional(),
  is_bodyweight: z.boolean().optional(),
  instructions_en: z.array(z.string()).default([]),
  instructions_es: z.array(z.string()).default([]),
  tips_es: z.array(z.string()).default([]),
  tips_en: z.array(z.string()).default([]),
  images: z
    .object({
      flat: z
        .object({ start: z.string().optional(), peak: z.string().optional(), main: z.string().optional() })
        .optional(),
    })
    .optional(),
});
export type RepDbRow = z.infer<typeof RepDbRow>;

export const RepDbDataset = z.object({ exercises: z.array(z.unknown()) });

export async function importRepDb(db: Db, rawRows: unknown[], options: ImportOptions): Promise<ImportSummary> {
  const summary = newSummary();
  const equipmentIds = await loadEquipmentIds(db);
  const rows = rawRows.map((r) => RepDbRow.parse(r));
  const subset = options.limit ? rows.slice(0, options.limit) : rows;

  for (const row of subset) {
    const slug = `rep-${slugify(row.id)}`;
    const bodyweight = row.is_bodyweight === true || (!row.equipment && row.tags.includes('bodyweight'));
    const primaryMuscles = normalizeMuscles(row.primary_muscles);
    const category = row.tags.includes('calisthenics') && !row.equipment ? 'skill' : row.category;
    const pattern = inferPattern({ name: row.name_en, mechanic: row.mechanic, category, primaryMuscles });
    const loadType = inferLoadType({ name: row.name_en, bodyweight, force: row.force_type });
    const equipmentSlugs = mapRepDbEquipment(row.equipment, row.name_en);

    const id = await upsertExercise(
      db,
      {
        slug,
        nameEs: row.name_es?.trim() || row.name_en,
        nameEn: row.name_en,
        pattern,
        category: inferCategory({ loadType, pattern, bodyweight }),
        primaryMuscles,
        secondaryMuscles: normalizeMuscles(row.secondary_muscles),
        loadType,
        level: normalizeLevel(row.difficulty),
        mechanic: row.mechanic ?? null,
        force: row.force_type ?? null,
        descriptionEs: row.description_es ?? null,
        descriptionEn: row.description_en ?? null,
        instructionsEs: row.instructions_es,
        instructionsEn: row.instructions_en,
        cuesEs: row.tips_es,
        meta: {
          goals: row.goals,
          tags: row.tags,
          bodyPart: row.body_part,
          unilateral: row.is_unilateral ?? false,
          originalEquipment: row.equipment ?? null,
        },
        source: SOURCE,
        sourceId: row.id,
        license: REPDB_LICENSE,
        attributionUrl: REPDB_ATTRIBUTION,
        // Traducciones humanas del proveedor: se muestran como texto definitivo.
        reviewed: Boolean(row.name_es && row.instructions_es.length > 0),
      },
      equipmentSlugs,
      equipmentIds,
      summary,
    );

    const flat = row.images?.flat;
    const media: MediaInput[] = [];
    if (flat?.start) media.push({ role: 'start', originUrl: REPDB_IMAGE_BASE + flat.start, source: SOURCE, license: REPDB_LICENSE, attributionUrl: REPDB_ATTRIBUTION, sortOrder: 0 });
    if (flat?.peak) media.push({ role: 'end', originUrl: REPDB_IMAGE_BASE + flat.peak, source: SOURCE, license: REPDB_LICENSE, attributionUrl: REPDB_ATTRIBUTION, sortOrder: 1 });
    if (flat?.main) media.push({ role: 'main', originUrl: REPDB_IMAGE_BASE + flat.main, source: SOURCE, license: REPDB_LICENSE, attributionUrl: REPDB_ATTRIBUTION, sortOrder: 0 });
    await replaceMedia(db, id, slug, media, options, summary);
    options.log?.(`  ${SOURCE}: ${row.name_en}`);
  }
  return summary;
}
