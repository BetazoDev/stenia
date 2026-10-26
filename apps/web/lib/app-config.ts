import 'server-only';

import { appConfig } from '@stenia/db';
import { eq, inArray } from 'drizzle-orm';

import { getDb } from './db';

/** Valores sueltos de configuración de la app (tabla `app_config`). */
export async function getConfig(key: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ value: appConfig.value })
    .from(appConfig)
    .where(eq(appConfig.key, key))
    .limit(1);
  return row?.value ?? null;
}

export async function setConfig(key: string, value: string): Promise<void> {
  await getDb()
    .insert(appConfig)
    .values({ key, value })
    .onConflictDoUpdate({ target: appConfig.key, set: { value, updatedAt: new Date() } });
}

export async function deleteConfig(...keys: string[]): Promise<void> {
  if (keys.length > 0) await getDb().delete(appConfig).where(inArray(appConfig.key, keys));
}
