import type { Db } from '@stenia/db';
import { seedEquipment } from '@stenia/db/seed';

import type { FetchBytes, ImportSummary } from './catalog';
import { CALISTHENICS_URL, importCalisthenics, parseJsonl } from './importers/calisthenics';
import { FREE_EXERCISE_DB_URL, importFreeExerciseDb } from './importers/free-exercise-db';
import { REPDB_URL, RepDbDataset, importRepDb } from './importers/repdb';
import type { Mirror } from './r2';

export const CATALOG_SOURCES = ['fed', 'cal', 'repdb'] as const;
export type CatalogSource = (typeof CATALOG_SOURCES)[number];

export const CATALOG_SOURCE_LABELS: Record<CatalogSource, string> = {
  fed: 'free-exercise-db',
  cal: 'Calistenia (Martjn)',
  repdb: 'RepDB',
};

export type ImportAllOptions = {
  sources?: CatalogSource[];
  mirror?: Mirror | null;
  limit?: number;
  fetchText?: (url: string) => Promise<string>;
  fetchBytes?: FetchBytes;
  log?: (message: string) => void;
  /** Avance global: fuente actual, procesados y total de esa fuente. */
  onProgress?: (source: CatalogSource, done: number, total: number) => void | Promise<void>;
};

const defaultFetchText = async (url: string) => {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`HTTP ${response.status} al descargar ${url}`);
  return response.text();
};

/**
 * Importa los tres catálogos en orden: RepDB primero (textos en español), luego free-exercise-db y por último el
 * grafo de progresiones de calistenia. Es idempotente: repetirlo actualiza sin duplicar.
 */
export async function importAllCatalogs(db: Db, options: ImportAllOptions = {}): Promise<Record<CatalogSource, ImportSummary>> {
  const sources = new Set(options.sources ?? CATALOG_SOURCES);
  const fetchText = options.fetchText ?? defaultFetchText;
  const base = { mirror: options.mirror ?? null, limit: options.limit, log: options.log, fetchBytes: options.fetchBytes };
  const empty: ImportSummary = { exercises: 0, media: 0, progressions: 0, skippedEquipment: [] };
  const out: Record<CatalogSource, ImportSummary> = { fed: empty, cal: empty, repdb: empty };
  // Los importadores mapean equipo por slug: se siembra antes por si la base es nueva (es idempotente).
  await seedEquipment(db);

  if (sources.has('repdb')) {
    const dataset = RepDbDataset.parse(JSON.parse(await fetchText(REPDB_URL)));
    out.repdb = await importRepDb(db, dataset.exercises, { ...base, onProgress: (d, t) => options.onProgress?.('repdb', d, t) });
  }
  if (sources.has('fed')) {
    const rows = JSON.parse(await fetchText(FREE_EXERCISE_DB_URL)) as unknown[];
    out.fed = await importFreeExerciseDb(db, rows, { ...base, onProgress: (d, t) => options.onProgress?.('fed', d, t) });
  }
  if (sources.has('cal')) {
    const rows = parseJsonl(await fetchText(CALISTHENICS_URL));
    out.cal = await importCalisthenics(db, rows, { ...base, onProgress: (d, t) => options.onProgress?.('cal', d, t) });
  }
  return out;
}
