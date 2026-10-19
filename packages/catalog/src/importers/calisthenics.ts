import type { Db, ProgressionThreshold } from '@stenia/db';
import { z } from 'zod';

import { loadEquipmentIds, newSummary, replaceMedia, upsertExercise, upsertProgression, type ImportOptions, type ImportSummary, type MediaInput } from '../catalog';
import { inferCategory, inferLoadType, inferPattern } from '../classify';
import { inferCalisthenicsEquipment } from '../equipment-map';
import { normalizeMuscles } from '../muscles';
import { slugify } from '../slug';
import { translateExerciseName } from '../translate-exercise';

export const CALISTHENICS_URL = 'https://huggingface.co/datasets/Martjn/calisthenics_exercises/resolve/main/exercises.jsonl';
export const CALISTHENICS_ATTRIBUTION = 'https://huggingface.co/datasets/Martjn/calisthenics_exercises';
const SOURCE = 'calisthenics';

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

const ADVANCED_RE = /90.?degree|freestanding|free.?standing|one.?arm|one.?leg(ged)? pull|archer pull|full planche|straddle planche|full front lever|full back lever|human flag|muscle.?up|maltese|iron cross|ring (handstand|muscle)|planche push|handstand push.?up|dragon flag|hefesto|victorian|manna|90 degree|one.?handed/i;
const INTERMEDIATE_RE = /tuck|advanced tuck|straddle|archer|typewriter|l.?sit|pistol|wall handstand push|pseudo planche|explosive|clap|diamond|decline|dips?\b|pull.?ups?\b|chin.?ups?\b|nordic/i;
const BEGINNER_RE = /wall|incline|knee|assisted|negative|band|pike|scapula|hang|australian|inverted row|box|elevated|support hold|plank|hollow|glute bridge|squat\b/i;

/** Nivel absoluto por nombre: el índice de la progresión del dataset es relativo a cada fila. */
export function calisthenicsLevel(name: string, stepIndex: number): 'beginner' | 'intermediate' | 'advanced' {
  if (ADVANCED_RE.test(name)) return 'advanced';
  if (INTERMEDIATE_RE.test(name) && !BEGINNER_RE.test(name)) return 'intermediate';
  if (BEGINNER_RE.test(name)) return 'beginner';
  return stepIndex === 0 ? 'beginner' : stepIndex === 1 ? 'intermediate' : 'advanced';
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
    const loadType = inferLoadType({ name, bodyweight: true, equipment: inferCalisthenicsEquipment(name, row.category) });
    const level = calisthenicsLevel(name, levelIndex);
    const id = await upsertExercise(
      db,
      {
        slug,
        nameEs: translateExerciseName(name),
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

  let done = 0;
  for (const row of subset) {
    const steps = [row.progression_1, row.progression_2, row.progression_3];
    const baseIndex = Math.max(0, steps.findIndex((s) => s.toLowerCase() === row.name.toLowerCase()));
    const base = await ensureExercise(row.name, row, true, baseIndex);

    // Solo HTTPS: una imagen http:// se bloquea como contenido mixto en la app.
  const images = row.links.filter((l) => l.type === 'image' && l.url.startsWith('https://') && l.license && ALLOWED_LICENSES.has(l.license));
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
    const loadType = inferLoadType({ name: row.name, bodyweight: true, equipment: inferCalisthenicsEquipment(row.name, row.category) });
    const threshold = thresholdFor(row.category, loadType);
    for (let i = 0; i < chain.length - 1; i += 1) {
      const from = chain[i];
      const to = chain[i + 1];
      if (from && to) await upsertProgression(db, from.id, to.id, threshold, SOURCE, summary);
    }
    options.log?.(`  ${SOURCE}: ${row.name}`);
    done += 1;
    await options.onProgress?.(done, subset.length);
  }
  return summary;
}
