import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema/index';

/** Tipo común para cualquier driver de Postgres (node-postgres en producción, PGlite en pruebas). */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export function createDb(connectionString: string, options: { max?: number } = {}) {
  const pool = new Pool({ connectionString, max: options.max ?? 5 });
  const db = drizzle({ client: pool, schema });
  return { db, pool };
}

export { schema };
