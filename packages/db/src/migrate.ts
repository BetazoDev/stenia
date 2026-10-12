import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

/** Aplica las migraciones de `packages/db/drizzle` con el migrador de drizzle-orm (no drizzle-kit). */
export async function runMigrations(db: NodePgDatabase<Record<string, unknown>>, migrationsFolder: string) {
  await migrate(db, { migrationsFolder });
}
