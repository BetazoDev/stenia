import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';


export type Mirror = {
  /** Sube el archivo si no existe y devuelve la URL pública. */
  put(key: string, body: Uint8Array, contentType: string): Promise<string>;
};

const value = (env: Record<string, string | undefined>, key: string) => {
  const v = env[key];
  return v && v.length > 0 ? v : undefined;
};

/** Espejo de medios en el bucket público de R2. Devuelve null si faltan credenciales (se conservan URLs de origen). */
export function createR2MirrorFromEnv(env: Record<string, string | undefined> = process.env): Mirror | null {
  const accountId = value(env, 'R2_ACCOUNT_ID');
  const accessKeyId = value(env, 'R2_ACCESS_KEY_ID');
  const secretAccessKey = value(env, 'R2_SECRET_ACCESS_KEY');
  const bucket = value(env, 'R2_BUCKET_PUBLIC');
  const publicBaseUrl = value(env, 'R2_PUBLIC_BASE_URL');
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) return null;

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  const base = publicBaseUrl.replace(/\/$/, '');

  return {
    async put(key, body, contentType) {
      const exists = await client
        .send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
        .then(() => true)
        .catch(() => false);
      if (!exists) {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
            CacheControl: 'public, max-age=31536000, immutable',
          }),
        );
      }
      return `${base}/${key}`;
    },
  };
}

export function contentTypeFor(url: string): string {
  const clean = url.split('?')[0]?.toLowerCase() ?? '';
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.gif')) return 'image/gif';
  if (clean.endsWith('.svg')) return 'image/svg+xml';
  return 'image/jpeg';
}

export function extensionFor(contentType: string): string {
  switch (contentType) {
    case 'image/webp':
      return 'webp';
    case 'image/png':
      return 'png';
    case 'image/gif':
      return 'gif';
    case 'image/svg+xml':
      return 'svg';
    default:
      return 'jpg';
  }
}
