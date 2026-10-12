#!/usr/bin/env bun
/**
 * Postgres local sin Docker: PGlite (Postgres en WASM) expuesto por el protocolo de red de Postgres.
 * Datos persistentes en .cache/pglite. Uso: pnpm db:dev  (DATABASE_URL=postgresql://stenia:stenia@127.0.0.1:5432/stenia)
 */
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const port = Number(process.env.PGLITE_PORT ?? 5432);
const dataDir = process.env.PGLITE_DATA_DIR ?? path.resolve(import.meta.dirname, '../.cache/pglite');

mkdirSync(dataDir, { recursive: true });
const db = await PGlite.create({ dataDir });
const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1' });
await server.start();
console.info(`PGlite listo en postgresql://stenia:stenia@127.0.0.1:${port}/stenia (datos en ${dataDir})`);

const stop = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
