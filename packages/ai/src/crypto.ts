import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';
const IV_BYTES = 12;

export class EncryptionKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionKeyError';
  }
}

/** Decodifica ENCRYPTION_KEY (32 bytes en base64) y valida su longitud. */
export function parseEncryptionKey(base64Key: string | undefined): Buffer {
  if (!base64Key) {
    throw new EncryptionKeyError('Falta ENCRYPTION_KEY (32 bytes en base64).');
  }
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32) {
    throw new EncryptionKeyError('ENCRYPTION_KEY debe tener exactamente 32 bytes en base64.');
  }
  return key;
}

/** Cifra un secreto con AES-256-GCM. Formato: v1:<iv>:<tag>:<cifrado>, todo en base64. */
export function encryptSecret(plaintext: string, base64Key: string | undefined): string {
  const key = parseEncryptionKey(base64Key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':');
}

export function decryptSecret(payload: string, base64Key: string | undefined): string {
  const key = parseEncryptionKey(base64Key);
  const [version, ivB64, tagB64, dataB64] = payload.split(':');
  if (version !== VERSION || !ivB64 || !tagB64 || !dataB64) {
    throw new EncryptionKeyError('Formato de secreto cifrado no reconocido.');
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
  return plaintext.toString('utf8');
}
