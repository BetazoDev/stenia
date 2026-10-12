import { createDb } from '@stenia/db';

import { requireEnv } from './env';

export function openDb() {
  const max = Number(process.env.DATABASE_POOL_MAX ?? 4);
  return createDb(requireEnv('DATABASE_URL'), { max: Number.isFinite(max) && max >= 1 ? max : 4 });
}
