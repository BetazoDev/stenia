#!/usr/bin/env bun
import { seedEquipment } from '@stenia/db/seed';

import { openDb } from './lib/db';

const { db, pool } = openDb();
try {
  const count = await seedEquipment(db);
  console.info(`Equipamiento sembrado: ${count} elementos.`);
} finally {
  await pool.end();
}
