import type { Db, ProgressionThreshold } from '@stenia/db';
import { z } from 'zod';

import { loadEquipmentIds, newSummary, replaceMedia, upsertExercise, upsertProgression, type ImportOptions, type ImportSummary, type MediaInput } from '../lib/catalog';
import { inferCategory, inferLoadType, inferPattern } from '../lib/classify';
import { inferCalisthenicsEquipment } from '../lib/equipment-map';
import { normalizeMuscles } from '../lib/muscles';
import { slugify } from '../lib/slug';

export const CALISTHENICS_URL = 'https://huggingface.co/datasets/Martjn/calisthenics_exercises/resolve/main/exercises.jsonl';
export const CALISTHENICS_ATTRIBUTION = 'https://huggingface.co/datasets/Martjn/calisthenics_exercises';
export const SOURCE = 'calisthenics';

const Link = z.object({
  source: z.string(),
  type: z.string(),
  url: z.string(),
  license: z.string().nullable(),
});

export const CalisthenicsRow = z.object({
  id: z.number(),
  name: z.string(),
  category: z.string(),
  primary_muscles: z.array(z.string()),
  description: z.string(),
  progression_1: z.string(),
  progression_2: z.string(),
  progression_3: z.string(),
  links: z.array(Link).default([]),
});
export type CalisthenicsRow = z.infer<typeof CalisthenicsRow>;

/** Solo imágenes con licencia explícita; los GIF de ExerciseDB quedan fuera hasta confirmar licencia. */
const ALLOWED_LICENSES = new Set(['public-domain', 'CC-BY-SA-3.0', 'CC-BY-SA-4.0', 'CC-BY-SA', 'CC-BY-4.0', 'CC-BY-3.0', 'CC0']);

function thresholdFor(category: string, loadType: string): ProgressionThreshold {
  if (loadType === 'isometric') return { kind: 'seconds', value: category === 'skill' ? 20 : 45, sessions: 3 };
  if (category === 'skill' || category === 'explosive') return { kind: 'reps', value: 5, sessions: 3 };
  if (category === 'core') return { kind: 'reps', value: 15, sessions: 3 };
  if (category === 'mobility') return { kind: 'seconds', value: 30, sessions: 3 };
  return { kind: 'reps', value: 12, sessions: 3 };
}

export function parseJsonl(text: string): unknown[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as unknown);
}

export async function importCalisthenics(db: Db, rawRows: unknown[], options: ImportOptions): Promise<ImportSummary> {
  const summary = newSummary();
  const equipmentIds = await loadEquipmentIds(db);
  const rows = rawRows.map((r) => CalisthenicsRow.parse(r));
  const subset = options.limit ? rows.slice(0, options.limit) : rows;
  const idsBySlug = new Map<string, string>();

  const ensureExercise = async (name: string, row: CalisthenicsRow, isBase: boolean, levelIndex: number) => {
    const slug = `cal-${slugify(name)}`;
    const cached = idsBySlug.get(slug);
    if (cached) return { id: cached, slug };
    const primaryMuscles = normalizeMuscles(row.primary_muscles);
    const pattern = inferPattern({ name, category: row.category, primaryMuscles });
    const loadType = inferLoadType({ name, bodyweight: true });
    const level = levelIndex === 0 ? 'beginner' : levelIndex === 1 ? 'intermediate' : 'advanced';
    const id = await upsertExercise(
      db,
      {
        slug,
        nameEs: name,
        nameEn: name,
        pattern,
        category: inferCategory({ loadType, pattern, bodyweight: true }),
        primaryMuscles,
        secondaryMuscles: [],
        loadType,
        level,
        descriptionEn: isBase ? row.description : null,
        instructionsEs: [],
        instructionsEn: [],
        meta: { originalCategory: row.category, datasetId: row.id, progressionStep: levelIndex + 1 },
        source: SOURCE,
        sourceId: isBase ? String(row.id) : `${row.id}:${levelIndex + 1}`,
        license: 'Apache-2.0 (dataset); imágenes con su propia licencia',
        attributionUrl: CALISTHENICS_ATTRIBUTION,
        reviewed: false,
      },
      inferCalisthenicsEquipment(name, row.category),
      equipmentIds,
      summary,
    );
    idsBySlug.set(slug, id);
    return { id, slug };
  };

  for (const row of subset) {
    const steps = [row.progression_1, row.progression_2, row.progression_3];
    const baseIndex = Math.max(0, steps.findIndex((s) => s.toLowerCase() === row.name.toLowerCase()));
    const base = await ensureExercise(row.name, row, true, baseIndex);

    const images = row.links.filter((l) => l.type === 'image' && l.license && ALLOWED_LICENSES.has(l.license));
    const media: MediaInput[] = images.slice(0, 2).map((link, index) => ({
      role: index === 0 ? 'start' : 'end',
      originUrl: link.url,
      source: link.source,
      license: link.license ?? 'unknown',
      attributionUrl: link.url,
      sortOrder: index,
    }));
    await replaceMedia(db, base.id, base.slug, media, options, summary);

    const chain: { id: string }[] = [];
    for (const [index, name] of steps.entries()) {
      const isBase = name.toLowerCase() === row.name.toLowerCase();
      chain.push(isBase ? base : await ensureExercise(name, row, false, index));
    }
    const loadType = inferLoadType({ name: row.name, bodyweight: true });
    const threshold = thresholdFor(row.category, loadType);
    for (let i = 0; i < chain.length - 1; i += 1) {
      const from = chain[i];
      const to = chain[i + 1];
      if (from && to) await upsertProgression(db, from.id, to.id, threshold, SOURCE, summary);
    }
    options.log?.(`  ${SOURCE}: ${row.name}`);
  }
  return summary;
}
