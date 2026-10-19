import 'server-only';

import { decryptSecret, encryptSecret } from '@stenia/ai';
import { appConfig, pushSubscription } from '@stenia/db';
import { and, eq } from 'drizzle-orm';
import webpush from 'web-push';

import { getDb } from './db';
import { env } from './env';

type Vapid = { publicKey: string; privateKey: string };

const holder = globalThis as unknown as { __steniaVapid?: Vapid; __steniaRestTimers?: Map<string, ReturnType<typeof setTimeout>> };

/**
 * Claves VAPID: las del entorno si existen; si no, se generan una vez y se guardan cifradas en `app_config`
 * (así Web Push funciona sin configurar nada en Dokploy).
 */
export async function getVapidKeys(): Promise<Vapid> {
  if (holder.__steniaVapid) return holder.__steniaVapid;
  const fromEnv = { publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '', privateKey: process.env.VAPID_PRIVATE_KEY ?? '' };
  if (fromEnv.publicKey && fromEnv.privateKey) {
    holder.__steniaVapid = fromEnv;
    return fromEnv;
  }
  const db = getDb();
  const key = env().ENCRYPTION_KEY;
  const [row] = await db.select().from(appConfig).where(eq(appConfig.key, 'vapid')).limit(1);
  if (row) {
    const json = row.encrypted ? decryptSecret(row.value, key) : row.value;
    holder.__steniaVapid = JSON.parse(json) as Vapid;
    return holder.__steniaVapid;
  }
  const generated = webpush.generateVAPIDKeys();
  const value = JSON.stringify(generated);
  await db
    .insert(appConfig)
    .values({ key: 'vapid', value: key ? encryptSecret(value, key) : value, encrypted: Boolean(key) })
    .onConflictDoNothing();
  holder.__steniaVapid = generated;
  return generated;
}

function subject(): string {
  return process.env.VAPID_SUBJECT || env().NEXT_PUBLIC_APP_URL || 'mailto:admin@localhost';
}

export type PushPayload = { title: string; body: string; tag?: string; url?: string };

export async function sendPush(userId: string, payload: PushPayload): Promise<number> {
  const db = getDb();
  const subs = await db.select().from(pushSubscription).where(eq(pushSubscription.userId, userId));
  if (subs.length === 0) return 0;
  const keys = await getVapidKeys();
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), {
        vapidDetails: { subject: subject(), publicKey: keys.publicKey, privateKey: keys.privateKey },
        TTL: 120,
        urgency: 'high',
      });
      sent += 1;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await db.delete(pushSubscription).where(eq(pushSubscription.id, s.id));
    }
  }
  return sent;
}

export async function saveSubscription(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent: string | null) {
  await getDb()
    .insert(pushSubscription)
    .values({ userId, endpoint: sub.endpoint, keys: sub.keys, userAgent })
    .onConflictDoUpdate({ target: pushSubscription.endpoint, set: { userId, keys: sub.keys, userAgent } });
}

export async function removeSubscription(userId: string, endpoint: string) {
  await getDb().delete(pushSubscription).where(and(eq(pushSubscription.userId, userId), eq(pushSubscription.endpoint, endpoint)));
}

export async function hasSubscription(userId: string): Promise<boolean> {
  const [row] = await getDb().select({ id: pushSubscription.id }).from(pushSubscription).where(eq(pushSubscription.userId, userId)).limit(1);
  return Boolean(row);
}

/** Aviso de fin de descanso cuando la PWA está en segundo plano (un temporizador por usuario, en memoria). */
export function scheduleRestPush(userId: string, endsAt: number | null, body: string) {
  const timers = (holder.__steniaRestTimers ??= new Map());
  const existing = timers.get(userId);
  if (existing) clearTimeout(existing);
  timers.delete(userId);
  if (endsAt === null) return;
  const delay = endsAt - Date.now();
  if (delay < 0 || delay > 20 * 60 * 1000) return;
  timers.set(
    userId,
    setTimeout(() => {
      timers.delete(userId);
      void sendPush(userId, { title: 'Descanso terminado', body, tag: 'rest', url: '/entrenar' });
    }, delay),
  );
}
