import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import path from 'node:path';

import * as schema from './schema/index';

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, '../drizzle');

/** Base de datos Postgres en memoria (PGlite) con todas las migraciones aplicadas. Solo para pruebas. */
export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return { db, client };
}
