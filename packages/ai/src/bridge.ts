import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { z } from 'zod';

/**
 * Protocolo del puente de IA: el servidor desplegado encola peticiones y un proceso en la Mac del usuario las
 * resuelve con su suscripción de Claude. La Mac solo hace peticiones salientes (HTTPS) al servidor.
 */

const ImageBlock = z.object({
  type: z.literal('image'),
  source: z.object({
    type: z.literal('base64'),
    media_type: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    data: z.string().max(12_000_000),
  }),
});
const TextBlock = z.object({ type: z.literal('text'), text: z.string().max(200_000) });
export const BridgeContentBlock = z.discriminatedUnion('type', [TextBlock, ImageBlock]);
export type BridgeContentBlock = z.infer<typeof BridgeContentBlock>;

export const BridgeJob = z.object({
  id: z.string().min(1),
  fn: z.string(),
  modelId: z.string().min(1),
  system: z.string(),
  prompt: z.string().nullable(),
  content: z.array(BridgeContentBlock).nullable(),
  jsonSchema: z.record(z.string(), z.unknown()),
  params: z.object({ temperature: z.number(), maxTokens: z.number(), timeoutMs: z.number().optional() }),
});
export type BridgeJob = z.infer<typeof BridgeJob>;

export const BridgeResult = z.object({
  id: z.string().min(1),
  ok: z.boolean(),
  output: z.unknown().optional(),
  message: z.string().max(2_000).optional(),
  modelId: z.string(),
  latencyMs: z.number().int().min(0),
  usage: z.object({ inputTokens: z.number().int().min(0), outputTokens: z.number().int().min(0), cachedInputTokens: z.number().int().min(0) }),
});
export type BridgeResult = z.infer<typeof BridgeResult>;

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const PairingCode = z.string().trim().toUpperCase().regex(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/, 'Código con formato ABCD-EF23');

export const PairRequest = z.object({
  code: PairingCode,
  tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  worker: z.string().trim().min(1).max(80),
});
export type PairRequest = z.infer<typeof PairRequest>;

export function newPairingCode(): string {
  const bytes = randomBytes(8);
  const chars = [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

export function newBridgeToken(): string {
  return `stb_${randomBytes(32).toString('base64url')}`;
}

export function hashBridgeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Compara el token recibido con el hash guardado sin filtrar tiempos. */
export function bridgeTokenMatches(token: string | null | undefined, storedHash: string | null | undefined): boolean {
  if (!token || !storedHash || !/^[a-f0-9]{64}$/.test(storedHash)) return false;
  const a = Buffer.from(hashBridgeToken(token), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** El puente se considera en línea si la Mac pidió trabajo en los últimos 70 s (sondea cada ≤ 25 s). */
export const BRIDGE_ONLINE_MS = 70_000;
export const BRIDGE_LONG_POLL_MS = 25_000;
