#!/usr/bin/env bun
import path from 'node:path';

import { runMigrations } from '@stenia/db/migrate';

import { openDb } from './lib/db';

const { db, pool } = openDb();
try {
  await runMigrations(db, path.resolve(import.meta.dirname, '../packages/db/drizzle'));
  console.info('Migraciones aplicadas.');
} finally {
  await pool.end();
}
