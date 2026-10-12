import { randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { EncryptionKeyError, decryptSecret, encryptSecret } from './crypto';

const key = randomBytes(32).toString('base64');

describe('cifrado AES-256-GCM', () => {
  it('cifra y descifra ida y vuelta', () => {
    const payload = encryptSecret('sk-prueba-1234', key);
    expect(payload.startsWith('v1:')).toBe(true);
    expect(payload).not.toContain('sk-prueba');
    expect(decryptSecret(payload, key)).toBe('sk-prueba-1234');
  });

  it('genera un IV distinto en cada cifrado', () => {
    expect(encryptSecret('x', key)).not.toBe(encryptSecret('x', key));
  });

  it('rechaza claves de longitud incorrecta o ausentes', () => {
    expect(() => encryptSecret('x', undefined)).toThrow(EncryptionKeyError);
    expect(() => encryptSecret('x', Buffer.from('corta').toString('base64'))).toThrow(EncryptionKeyError);
  });

  it('falla si el payload fue alterado', () => {
    const payload = encryptSecret('secreto', key);
    const tampered = payload.slice(0, -2) + 'AA';
    expect(() => decryptSecret(tampered, key)).toThrow();
  });
});
