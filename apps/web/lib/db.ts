import 'server-only';

import { createDb } from '@stenia/db';

import { env } from './env';

type Holder = { __steniaDb?: ReturnType<typeof createDb> };
const holder = globalThis as unknown as Holder;

/** Tamaño del pool: 5 por defecto; con `pnpm db:dev` (PGlite, monoconexión) usar DATABASE_POOL_MAX=1. */
function poolMax(): number {
  const raw = Number(process.env.DATABASE_POOL_MAX ?? 5);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 5;
}

/** Conexión única por proceso (se conserva entre recargas en desarrollo). */
export function getDb() {
  if (!holder.__steniaDb) {
    holder.__steniaDb = createDb(env().DATABASE_URL, { max: poolMax() });
  }
  return holder.__steniaDb.db;
}
