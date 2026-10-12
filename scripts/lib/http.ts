import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CACHE_DIR = path.resolve(import.meta.dirname, '../.cache');

/** Descarga con caché en disco (scripts/.cache) para no repetir descargas entre corridas. */
export async function fetchBytes(url: string, options: { cache?: boolean } = {}): Promise<Uint8Array> {
  const useCache = options.cache ?? true;
  const key = createHash('sha1').update(url).digest('hex');
  const file = path.join(CACHE_DIR, key);
  if (useCache) {
    try {
      return new Uint8Array(await readFile(file));
    } catch {
      // sin caché: se descarga
    }
  }
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`HTTP ${response.status} al descargar ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (useCache) {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(file, bytes);
  }
  return bytes;
}

export async function fetchText(url: string): Promise<string> {
  return new TextDecoder().decode(await fetchBytes(url));
}

export async function fetchJson<T>(url: string): Promise<T> {
  return JSON.parse(await fetchText(url)) as T;
}
