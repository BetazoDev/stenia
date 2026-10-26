import 'server-only';

import {
  BRIDGE_LONG_POLL_MS,
  BRIDGE_ONLINE_MS,
  bridgeTokenMatches,
  toContentBlocks,
  type BridgeJob,
  type BridgeResult,
  type CallParams,
  type ModelMessage,
  type PairRequest,
  type StructuredFailure,
  type StructuredSuccess,
} from '@stenia/ai';
import { aiBridgeRequest } from '@stenia/db';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { z } from 'zod';

import { deleteConfig, getConfig, setConfig } from './app-config';
import { getDb } from './db';

/**
 * Puente de IA (servidor): encola peticiones para la Mac del usuario, que las resuelve con su suscripción de
 * Claude, y espera el resultado. Ver docs/decisions.md (2026-10-21).
 */

const KEY_TOKEN = 'ai_bridge_token_hash';
const KEY_HEARTBEAT = 'ai_bridge_heartbeat';
const KEY_PAIRING = 'ai_bridge_pairing';
const PAIRING_TTL_MS = 10 * 60 * 1000;

/** En el servidor desplegado la suscripción se usa por el puente; en la Mac, directo. */
export function usesBridge(provider: string): boolean {
  return provider === 'claude_code' && process.env.STENIA_DEPLOYMENT === 'server';
}

/** Una petición más vieja que esto ya no tiene quien la espere (el servidor espera como máximo 175 s). */
const STALE_REQUEST_MS = 180_000;

// ── Vinculación ───────────────────────────────────────────────────────────────────────────

const Pairing = z.object({ code: z.string(), tokenHash: z.string(), worker: z.string(), expiresAt: z.number() });

/** La Mac propone su hash de token y un código; queda pendiente hasta que el admin escribe el código en la app. */
export async function registerPairing(input: PairRequest): Promise<{ ok: true } | { ok: false; message: string }> {
  const raw = await getConfig(KEY_PAIRING);
  const current = raw ? Pairing.safeParse(JSON.parse(raw)) : null;
  if (current?.success && current.data.expiresAt > Date.now() && current.data.code !== input.code) {
    return { ok: false, message: 'Ya hay una vinculación pendiente; termínala o espera 10 minutos.' };
  }
  await setConfig(KEY_PAIRING, JSON.stringify({ ...input, expiresAt: Date.now() + PAIRING_TTL_MS }));
  return { ok: true };
}

export async function approvePairing(code: string): Promise<{ ok: true; worker: string } | { ok: false; message: string }> {
  const raw = await getConfig(KEY_PAIRING);
  const pending = raw ? Pairing.safeParse(JSON.parse(raw)) : null;
  if (!pending?.success || pending.data.expiresAt < Date.now()) return { ok: false, message: 'No hay una vinculación pendiente (o venció). Corre de nuevo pnpm ai:bridge setup.' };
  if (pending.data.code !== code.trim().toUpperCase()) return { ok: false, message: 'El código no coincide.' };
  await setConfig(KEY_TOKEN, pending.data.tokenHash);
  await deleteConfig(KEY_PAIRING, KEY_HEARTBEAT);
  return { ok: true, worker: pending.data.worker };
}

export async function unpairBridge() {
  await deleteConfig(KEY_TOKEN, KEY_HEARTBEAT, KEY_PAIRING);
  await getDb().update(aiBridgeRequest).set({ status: 'expired', payload: {}, finishedAt: new Date() }).where(inArray(aiBridgeRequest.status, ['pending', 'running']));
}

export async function verifyBridgeAuth(header: string | null): Promise<boolean> {
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
  return bridgeTokenMatches(token, await getConfig(KEY_TOKEN));
}

export type BridgeState = {
  paired: boolean;
  online: boolean;
  lastSeenAt: string | null;
  worker: string | null;
  pending: number;
  pairingPending: { worker: string; expiresAt: number } | null;
};

export async function bridgeState(): Promise<BridgeState> {
  const [tokenHash, heartbeat, pairing, pendingRows] = await Promise.all([
    getConfig(KEY_TOKEN),
    getConfig(KEY_HEARTBEAT),
    getConfig(KEY_PAIRING),
    getDb()
      .select({ n: sql<number>`count(*)::int` })
      .from(aiBridgeRequest)
      .where(inArray(aiBridgeRequest.status, ['pending', 'running'])),
  ]);
  const hb = heartbeat ? (JSON.parse(heartbeat) as { at: number; worker: string }) : null;
  const pend = pairing ? Pairing.safeParse(JSON.parse(pairing)) : null;
  return {
    paired: Boolean(tokenHash),
    online: Boolean(tokenHash && hb && Date.now() - hb.at < BRIDGE_ONLINE_MS),
    lastSeenAt: hb ? new Date(hb.at).toISOString() : null,
    worker: hb?.worker ?? null,
    pending: pendingRows[0]?.n ?? 0,
    pairingPending: pend?.success && pend.data.expiresAt > Date.now() ? { worker: pend.data.worker, expiresAt: pend.data.expiresAt } : null,
  };
}

// ── Lado de la Mac: reclamar y devolver ───────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Espera hasta 25 s (o `waitMs`) por una petición pendiente y la marca como en curso (una a la vez). */
export async function claimNext(worker: string, waitMs = BRIDGE_LONG_POLL_MS): Promise<BridgeJob | null> {
  const deadline = Date.now() + Math.min(Math.max(0, waitMs), BRIDGE_LONG_POLL_MS);
  // Un latido por llamada basta: la Mac vuelve a pedir trabajo cada ≤ 25 s y el umbral de conexión es de 70 s.
  await setConfig(KEY_HEARTBEAT, JSON.stringify({ at: Date.now(), worker: worker.slice(0, 80) }));
  const staleBefore = new Date(Date.now() - STALE_REQUEST_MS);
  for (;;) {
    // Las pendientes que nadie espera (p. ej. el servidor se reinició a media espera) no se atienden.
    const result = await getDb().execute(sql`
      update ${aiBridgeRequest} set status = 'running', claimed_at = now()
      where id = (
        select id from ${aiBridgeRequest}
        where status = 'pending' and created_at > ${staleBefore}
        order by created_at limit 1 for update skip locked
      )
      returning id, fn, model_id, payload`);
    const row = result.rows[0] as { id: string; fn: string; model_id: string; payload: Omit<BridgeJob, 'id' | 'fn' | 'modelId'> } | undefined;
    if (row) return { id: row.id, fn: row.fn, modelId: row.model_id, ...row.payload };
    if (Date.now() >= deadline) return null;
    await sleep(1000);
  }
}

export async function finishRequest(result: BridgeResult) {
  await getDb()
    .update(aiBridgeRequest)
    .set({
      status: result.ok ? 'done' : 'error',
      output: result.ok ? (result.output ?? null) : null,
      error: result.ok ? null : (result.message ?? 'Error en la Mac.'),
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      cachedInputTokens: result.usage.cachedInputTokens,
      latencyMs: result.latencyMs,
      // El prompt y las imágenes ya no se necesitan: se borran al terminar.
      payload: {},
      finishedAt: new Date(),
    })
    .where(and(eq(aiBridgeRequest.id, result.id), eq(aiBridgeRequest.status, 'running')));
}

// ── Lado del servidor: encolar y esperar ──────────────────────────────────────────────────

export async function bridgeGenerate<T>(req: {
  userId: string | null;
  fn: string;
  modelId: string;
  params: CallParams;
  schema: z.ZodType<T>;
  system: string;
  prompt?: string | undefined;
  messages?: ModelMessage[] | undefined;
}): Promise<StructuredSuccess<T> | StructuredFailure> {
  const started = performance.now();
  const empty = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 };
  const fail = (message: string): StructuredFailure => ({ ok: false, message, usage: empty, modelId: req.modelId, latencyMs: Math.round(performance.now() - started) });
  const db = getDb();
  // Limpieza: nada del puente se guarda más de un día.
  await db.delete(aiBridgeRequest).where(lt(aiBridgeRequest.createdAt, new Date(Date.now() - 86_400_000)));
  const timeoutMs = Math.min(req.params.timeoutMs ?? 170_000, 175_000);
  const payload: Omit<BridgeJob, 'id' | 'fn' | 'modelId'> = {
    system: req.system,
    prompt: req.messages ? null : (req.prompt ?? ''),
    content: req.messages ? toContentBlocks(req.messages) : null,
    jsonSchema: z.toJSONSchema(req.schema, { target: 'draft-7', io: 'output' }) as Record<string, unknown>,
    params: { temperature: req.params.temperature, maxTokens: req.params.maxTokens, timeoutMs: timeoutMs - 5_000 },
  };
  const [row] = await db
    .insert(aiBridgeRequest)
    .values({ userId: req.userId, fn: req.fn, modelId: req.modelId, payload: payload as unknown as Record<string, unknown> })
    .returning({ id: aiBridgeRequest.id });
  if (!row) return fail('No se pudo encolar la petición.');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(750);
    const [r] = await db.select().from(aiBridgeRequest).where(eq(aiBridgeRequest.id, row.id)).limit(1);
    if (!r) return fail('La petición desapareció de la cola.');
    if (r.status === 'expired') return fail('La petición se canceló (se desvinculó la Mac).');
    if (r.status === 'done' || r.status === 'error') {
      const usage = { inputTokens: r.inputTokens, outputTokens: r.outputTokens, cachedInputTokens: r.cachedInputTokens };
      const latencyMs = Math.round(performance.now() - started);
      if (r.status === 'error') return { ok: false, message: r.error ?? 'Error en la Mac.', usage, modelId: req.modelId, latencyMs };
      const parsed = req.schema.safeParse(r.output);
      if (!parsed.success) return { ok: false, message: `Salida inválida: ${parsed.error.issues.slice(0, 3).map((i) => i.message).join('; ')}`, usage, modelId: req.modelId, latencyMs };
      return { ok: true, output: parsed.data, usage, modelId: req.modelId, latencyMs, text: '' };
    }
  }
  await db.update(aiBridgeRequest).set({ status: 'expired', payload: {}, finishedAt: new Date() }).where(eq(aiBridgeRequest.id, row.id));
  return fail('Tu Mac no respondió a tiempo; se usa la versión sin IA.');
}
