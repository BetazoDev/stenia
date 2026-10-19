#!/usr/bin/env bun
/**
 * Importa los catálogos de ejercicios (sección 8 del PRD) a Postgres y espeja las imágenes en R2.
 *
 * Uso: bun run scripts/import-exercises.ts [--source=fed,cal,repdb] [--limit=N] [--no-mirror] [--quiet]
 */
import { parseArgs } from 'node:util';

import { CATALOG_SOURCES, countExercisesBySource, createR2MirrorFromEnv, importAllCatalogs, type CatalogSource } from '@stenia/catalog';

import { openDb } from './lib/db';
import { fetchBytes, fetchText } from './lib/http';

const { values } = parseArgs({
  options: {
    source: { type: 'string', default: CATALOG_SOURCES.join(',') },
    limit: { type: 'string' },
    'no-mirror': { type: 'boolean', default: false },
    quiet: { type: 'boolean', default: false },
  },
});

const sources = (values.source ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter((s): s is CatalogSource => (CATALOG_SOURCES as readonly string[]).includes(s));
const limit = values.limit ? Number(values.limit) : undefined;
const mirror = values['no-mirror'] ? null : createR2MirrorFromEnv();

if (!mirror) console.warn('Sin credenciales de R2 (o --no-mirror): se guardan las URLs de origen sin espejo.');

const { db, pool } = openDb();
try {
  const summary = await importAllCatalogs(db, {
    sources,
    mirror,
    limit,
    fetchText,
    fetchBytes,
    log: values.quiet ? undefined : (m) => console.info(m),
  });
  console.info(JSON.stringify(summary, null, 2));
  console.info('Ejercicios por fuente:', await countExercisesBySource(db));
} finally {
  await pool.end();
}
