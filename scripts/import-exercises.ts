#!/usr/bin/env bun
/**
 * Importa los catálogos de ejercicios (sección 8 del PRD) a Postgres y espeja las imágenes en R2.
 *
 * Uso: bun run scripts/import-exercises.ts [--source=fed,cal,repdb] [--limit=N] [--no-mirror] [--quiet]
 */
import { parseArgs } from 'node:util';

import { countExercisesBySource } from './lib/catalog';
import { openDb } from './lib/db';
import { fetchJson, fetchText } from './lib/http';
import { createR2MirrorFromEnv } from './lib/r2';
import { CALISTHENICS_URL, importCalisthenics, parseJsonl } from './importers/calisthenics';
import { FREE_EXERCISE_DB_URL, importFreeExerciseDb } from './importers/free-exercise-db';
import { REPDB_URL, RepDbDataset, importRepDb } from './importers/repdb';

const { values } = parseArgs({
  options: {
    source: { type: 'string', default: 'fed,cal,repdb' },
    limit: { type: 'string' },
    'no-mirror': { type: 'boolean', default: false },
    quiet: { type: 'boolean', default: false },
  },
});

const sources = new Set((values.source ?? '').split(',').map((s) => s.trim()).filter(Boolean));
const limit = values.limit ? Number(values.limit) : undefined;
const mirror = values['no-mirror'] ? null : createR2MirrorFromEnv();
const log = values.quiet ? undefined : (message: string) => console.info(message);

if (!mirror) {
  console.warn('Sin credenciales de R2 (o --no-mirror): se guardan las URLs de origen sin espejo.');
}

const { db, pool } = openDb();
try {
  if (sources.has('fed')) {
    console.info('→ free-exercise-db');
    const rows = await fetchJson<unknown[]>(FREE_EXERCISE_DB_URL);
    console.info(JSON.stringify(await importFreeExerciseDb(db, rows, { mirror, limit, log })));
  }
  if (sources.has('cal')) {
    console.info('→ calisthenics (Martjn/calisthenics_exercises)');
    const rows = parseJsonl(await fetchText(CALISTHENICS_URL));
    console.info(JSON.stringify(await importCalisthenics(db, rows, { mirror, limit, log })));
  }
  if (sources.has('repdb')) {
    console.info('→ RepDB free');
    const dataset = RepDbDataset.parse(await fetchJson(REPDB_URL));
    console.info(JSON.stringify(await importRepDb(db, dataset.exercises, { mirror, limit, log })));
  }
  console.info('Ejercicios por fuente:', await countExercisesBySource(db));
} finally {
  await pool.end();
}
