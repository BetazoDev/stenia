import 'server-only';

import { ema, navyBodyFat, type Sex } from '@stenia/core';
import { bodyMeasurement, bodyPhoto, profile } from '@stenia/db';
import { and, asc, desc, eq } from 'drizzle-orm';

import { getDb } from './db';
import { localDateString } from './dates';
import { deletePrivate, privateUrl, putPrivate, type StorageDriver } from './storage';

export type MeasurementInput = {
  measuredAt: string;
  weightKg: number | null;
  neckCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  armCm: number | null;
  thighCm: number | null;
  bodyFatPct?: number | null;
  bodyFatMethod?: 'navy' | 'bia' | 'inbody' | 'dexa' | 'photo_estimate' | 'manual' | null;
  leanMassKg?: number | null;
  bmrMeasured?: number | null;
  source?: string;
  approximate?: boolean;
  raw?: Record<string, unknown> | null;
  notes?: string | null;
};

/** Guarda una medición; si hay cuello/cintura (y cadera en mujeres), calcula % grasa con la Marina. */
export async function addMeasurement(userId: string, input: MeasurementInput) {
  const db = getDb();
  const [p] = await db.select({ sex: profile.sex, heightCm: profile.heightCm }).from(profile).where(eq(profile.userId, userId));
  let bodyFatPct = input.bodyFatPct ?? null;
  let method = input.bodyFatMethod ?? null;
  if (bodyFatPct === null && p?.sex && p.heightCm && input.waistCm && input.neckCm) {
    bodyFatPct = navyBodyFat({ sex: p.sex as Sex, heightCm: p.heightCm, waistCm: input.waistCm, neckCm: input.neckCm, hipCm: input.hipCm });
    if (bodyFatPct !== null) method = 'navy';
  }
  const leanMassKg = input.leanMassKg ?? (bodyFatPct !== null && input.weightKg ? Math.round(input.weightKg * (1 - bodyFatPct / 100) * 10) / 10 : null);
  const [row] = await db
    .insert(bodyMeasurement)
    .values({
      userId,
      measuredAt: input.measuredAt,
      weightKg: input.weightKg,
      neckCm: input.neckCm,
      waistCm: input.waistCm,
      hipCm: input.hipCm,
      armCm: input.armCm,
      thighCm: input.thighCm,
      bodyFatPct,
      bodyFatMethod: method,
      leanMassKg,
      bmrMeasured: input.bmrMeasured ?? null,
      source: input.source ?? 'manual',
      approximate: input.approximate ?? false,
      raw: input.raw ?? null,
      notes: input.notes ?? null,
    })
    .returning();
  if (input.weightKg && !input.approximate) {
    await db.update(profile).set({ weightKg: input.weightKg, updatedAt: new Date() }).where(eq(profile.userId, userId));
  }
  return row;
}

export async function listMeasurements(userId: string, limit = 120) {
  return getDb().select().from(bodyMeasurement).where(eq(bodyMeasurement.userId, userId)).orderBy(desc(bodyMeasurement.measuredAt), desc(bodyMeasurement.createdAt)).limit(limit);
}

export async function deleteMeasurement(userId: string, id: string) {
  await getDb().delete(bodyMeasurement).where(and(eq(bodyMeasurement.userId, userId), eq(bodyMeasurement.id, id)));
}

/** Serie de peso (sin estimaciones aproximadas) y su tendencia suavizada. */
export async function weightSeries(userId: string) {
  const rows = await getDb()
    .select({ date: bodyMeasurement.measuredAt, weight: bodyMeasurement.weightKg, approximate: bodyMeasurement.approximate })
    .from(bodyMeasurement)
    .where(eq(bodyMeasurement.userId, userId))
    .orderBy(asc(bodyMeasurement.measuredAt));
  const raw = rows.filter((r) => r.weight !== null && !r.approximate).map((r) => ({ date: r.date, value: r.weight as number }));
  const trend = ema(raw);
  const now = Date.now();
  const at = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
  const last7 = raw.filter((w) => at(w.date) >= now - 7 * 86_400_000);
  const trend4wAgo = trend.find((t) => at(t.date) >= now - 28 * 86_400_000)?.value ?? null;
  return {
    raw,
    trend,
    /** Cambio de la tendencia en ~4 semanas (null si no hay datos suficientes). */
    trendChange4w: trend.length > 1 && trend4wAgo !== null ? Math.round(((trend[trend.length - 1]?.value ?? trend4wAgo) - trend4wAgo) * 10) / 10 : null,
    avg7d: last7.length ? Math.round((last7.reduce((a, w) => a + w.value, 0) / last7.length) * 10) / 10 : null,
  };
}

export async function latestBodyComposition(userId: string) {
  const rows = await getDb()
    .select()
    .from(bodyMeasurement)
    .where(eq(bodyMeasurement.userId, userId))
    .orderBy(desc(bodyMeasurement.measuredAt), desc(bodyMeasurement.createdAt))
    .limit(30);
  const reliable = rows.filter((r) => !r.approximate);
  return {
    weightKg: reliable.find((r) => r.weightKg !== null)?.weightKg ?? null,
    bodyFatPct: reliable.find((r) => r.bodyFatPct !== null)?.bodyFatPct ?? null,
    bodyFatMethod: reliable.find((r) => r.bodyFatPct !== null)?.bodyFatMethod ?? null,
    leanMassKg: reliable.find((r) => r.leanMassKg !== null)?.leanMassKg ?? null,
    bmrMeasured: reliable.find((r) => r.bmrMeasured !== null)?.bmrMeasured ?? null,
  };
}

// ── Fotos corporales (opt-in explícito, almacenamiento privado) ───────────────────────────

export async function setPhotosConsent(userId: string, consent: boolean) {
  await getDb().update(profile).set({ photosConsentAt: consent ? new Date() : null, updatedAt: new Date() }).where(eq(profile.userId, userId));
}

export async function savePhoto(userId: string, input: { pose: 'front' | 'side' | 'back'; data: Uint8Array; contentType: string; landmarks: Record<string, unknown> | null }) {
  const id = crypto.randomUUID();
  const key = `photos/${userId}/${localDateString()}/${input.pose}-${id}.jpg`;
  const driver = await putPrivate(userId, key, input.data, input.contentType);
  const [row] = await getDb()
    .insert(bodyPhoto)
    .values({ id, userId, takenAt: new Date(), pose: input.pose, storageKey: key, storageDriver: driver, contentType: input.contentType, sizeBytes: input.data.byteLength, landmarks: input.landmarks })
    .returning();
  return row;
}

export async function listPhotos(userId: string) {
  const rows = await getDb().select().from(bodyPhoto).where(eq(bodyPhoto.userId, userId)).orderBy(desc(bodyPhoto.takenAt));
  return Promise.all(rows.map(async (r) => ({ ...r, url: await privateUrl(r.storageKey, r.storageDriver as StorageDriver, r.id) })));
}

export async function getPhoto(userId: string, id: string) {
  const [row] = await getDb().select().from(bodyPhoto).where(and(eq(bodyPhoto.userId, userId), eq(bodyPhoto.id, id))).limit(1);
  return row ?? null;
}

export async function deletePhoto(userId: string, id: string) {
  const row = await getPhoto(userId, id);
  if (!row) return;
  await deletePrivate(userId, row.storageKey, row.storageDriver as StorageDriver);
  await getDb().delete(bodyPhoto).where(and(eq(bodyPhoto.userId, userId), eq(bodyPhoto.id, id)));
}

export async function deleteAllPhotos(userId: string) {
  const rows = await getDb().select().from(bodyPhoto).where(eq(bodyPhoto.userId, userId));
  for (const r of rows) await deletePrivate(userId, r.storageKey, r.storageDriver as StorageDriver);
  await getDb().delete(bodyPhoto).where(eq(bodyPhoto.userId, userId));
}
