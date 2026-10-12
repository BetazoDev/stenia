// Migrador de arranque para producción: usa drizzle-orm (no drizzle-kit) contra ./drizzle (ver infra/Dockerfile).
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Falta DATABASE_URL; no se pueden aplicar migraciones.');
  process.exit(1);
}

const migrationsFolder = process.env.MIGRATIONS_DIR ?? fileURLToPath(new URL('../../drizzle', import.meta.url));
const pool = new pg.Pool({ connectionString, max: 1 });
const db = drizzle({ client: pool });

try {
  await migrate(db, { migrationsFolder });
  console.info(`Migraciones aplicadas desde ${migrationsFolder}`);
} catch (error) {
  console.error('Error al aplicar migraciones:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
