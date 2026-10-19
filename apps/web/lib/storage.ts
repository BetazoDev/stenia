import 'server-only';

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { storedFile } from '@stenia/db';
import { and, eq } from 'drizzle-orm';

import { getDb } from './db';

/**
 * Almacenamiento privado (fotos corporales, tickets). Usa el bucket privado de R2 si está configurado; si no,
 * guarda en Postgres (`stored_file`) y se sirve solo por una ruta autenticada (docs/decisions.md).
 */

export type StorageDriver = 'r2' | 'db';

function r2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_PRIVATE;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return {
    bucket,
    client: new S3Client({ region: 'auto', endpoint: `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey } }),
  };
}

export function activeDriver(): StorageDriver {
  return r2Config() ? 'r2' : 'db';
}

export async function putPrivate(userId: string, key: string, data: Uint8Array, contentType: string): Promise<StorageDriver> {
  const r2 = r2Config();
  if (r2) {
    await r2.client.send(new PutObjectCommand({ Bucket: r2.bucket, Key: key, Body: data, ContentType: contentType }));
    return 'r2';
  }
  await getDb().insert(storedFile).values({ userId, key, contentType, sizeBytes: data.byteLength, data });
  return 'db';
}

/** URL firmada de corta duración (R2) o ruta interna autenticada (base de datos). */
export async function privateUrl(key: string, driver: StorageDriver, fileId: string): Promise<string> {
  const r2 = r2Config();
  if (driver === 'r2' && r2) {
    return getSignedUrl(r2.client, new GetObjectCommand({ Bucket: r2.bucket, Key: key }), { expiresIn: 300 });
  }
  return `/api/files/${fileId}`;
}

export async function readPrivateFromDb(userId: string, key: string) {
  const [row] = await getDb().select().from(storedFile).where(and(eq(storedFile.userId, userId), eq(storedFile.key, key))).limit(1);
  return row ?? null;
}

export async function deletePrivate(userId: string, key: string, driver: StorageDriver) {
  const r2 = r2Config();
  if (driver === 'r2' && r2) {
    await r2.client.send(new DeleteObjectCommand({ Bucket: r2.bucket, Key: key }));
    return;
  }
  await getDb().delete(storedFile).where(and(eq(storedFile.userId, userId), eq(storedFile.key, key)));
}

/** Bytes de un archivo privado (para enviarlo al LLM solo por acción explícita del usuario). */
export async function readPrivate(userId: string, key: string, driver: StorageDriver): Promise<{ data: Uint8Array; contentType: string } | null> {
  const r2 = r2Config();
  if (driver === 'r2' && r2) {
    const res = await r2.client.send(new GetObjectCommand({ Bucket: r2.bucket, Key: key }));
    if (!res.Body) return null;
    return { data: await res.Body.transformToByteArray(), contentType: res.ContentType ?? 'image/jpeg' };
  }
  const row = await readPrivateFromDb(userId, key);
  return row ? { data: new Uint8Array(row.data), contentType: row.contentType } : null;
}
