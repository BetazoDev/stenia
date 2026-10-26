// Migrador de arranque para producción: usa drizzle-orm (no drizzle-kit) contra ./drizzle (ver infra/Dockerfile).
// Después siembra el catálogo de equipamiento (idempotente): sin él no se puede configurar el gimnasio ni importar
// ejercicios, y en el servidor no hay forma de correr `pnpm db:seed`.
import { seedEquipment } from '@stenia/db/seed';
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
  // drizzle envuelve el error de Postgres: el motivo real está en `cause`.
  const cause = error instanceof Error && error.cause instanceof Error ? ` · ${error.cause.message}` : '';
  console.error('Error al aplicar migraciones:', `${error instanceof Error ? error.message.split('\n')[0].slice(0, 200) : error}${cause}`);
  process.exitCode = 1;
}

// La semilla no detiene el arranque: si falla, la app sigue y el importador del catálogo la reintenta.
if (process.exitCode !== 1) {
  try {
    console.info(`Equipamiento sembrado: ${await seedEquipment(db)} elementos.`);
  } catch (error) {
    console.error('No se pudo sembrar el equipamiento:', error instanceof Error ? error.message : error);
  }
}

await pool.end();
