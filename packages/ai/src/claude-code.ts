import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { query as QueryFn, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import type { ModelMessage } from 'ai';
import { z } from 'zod';

import type { CallParams, StructuredFailure, StructuredSuccess, StructuredUsage } from './structured';

/**
 * Proveedor «Suscripción de Claude»: ejecuta las llamadas con el Claude Agent SDK en el equipo donde corre el
 * servidor, autenticado con la cuenta de Claude (login local de Claude Code o `CLAUDE_CODE_OAUTH_TOKEN` generado
 * con `claude setup-token`). No cobra por token: consume los límites de uso de la suscripción.
 *
 * Cada llamada es un turno aislado: sin herramientas, sin MCP, sin ajustes ni CLAUDE.md, en un directorio vacío y
 * sin guardar la sesión. La salida se fuerza con JSON Schema (`outputFormat`) y se valida otra vez con zod.
 */

export type ClaudeCodeRequest<T> = {
  modelId: string;
  /** JSON Schema ya generado (lo manda el servidor por el puente); si falta, se deriva de `schema`. */
  jsonSchema?: Record<string, unknown> | undefined;
  /** Bloques ya convertidos (texto e imágenes base64), alternativa a `messages`. */
  content?: ContentBlock[] | undefined;
  /** Token de `claude setup-token`; vacío para usar el login local de Claude Code. */
  oauthToken?: string | undefined;
  params: CallParams;
  schema: z.ZodType<T>;
  system: string;
  prompt?: string | undefined;
  messages?: ModelMessage[] | undefined;
};

let sandboxDir: string | null = null;
function sandbox(): string {
  sandboxDir ??= mkdtempSync(path.join(tmpdir(), 'stenia-claude-'));
  return sandboxDir;
}

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'; data: string } };

function toBase64(image: unknown): string | null {
  if (image instanceof Uint8Array) return Buffer.from(image).toString('base64');
  if (image instanceof ArrayBuffer) return Buffer.from(new Uint8Array(image)).toString('base64');
  if (typeof image === 'string') return image.startsWith('data:') ? (image.split(',')[1] ?? null) : image;
  return null;
}

/** Convierte los mensajes del AI SDK (texto e imágenes) a bloques de la API de mensajes. */
export function toContentBlocks(messages: ModelMessage[]): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  for (const m of messages) {
    if (m.role !== 'user') continue;
    if (typeof m.content === 'string') {
      blocks.push({ type: 'text', text: m.content });
      continue;
    }
    for (const part of m.content) {
      if (part.type === 'text') blocks.push({ type: 'text', text: part.text });
      if (part.type === 'image') {
        const data = toBase64(part.image);
        const mediaType = (part.mediaType ?? 'image/jpeg') as 'image/jpeg';
        if (data) blocks.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data } });
      }
    }
  }
  return blocks;
}

const AUTH_HINT = 'Inicia sesión con tu cuenta de Claude en este equipo: pnpm claude auth login (o guarda el token de pnpm claude setup-token).';

export async function generateWithClaudeCode<T>(req: ClaudeCodeRequest<T>): Promise<StructuredSuccess<T> | StructuredFailure> {
  const started = performance.now();
  const usage: StructuredUsage = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 };
  const elapsed = () => Math.round(performance.now() - started);
  const fail = (message: string): StructuredFailure => ({ ok: false, message, usage, modelId: req.modelId, latencyMs: elapsed() });

  // Import dinámico: el SDK solo se carga cuando se usa este proveedor.
  let query: typeof QueryFn;
  try {
    ({ query } = await import('@anthropic-ai/claude-agent-sdk'));
  } catch {
    return fail('No está instalado el Claude Agent SDK en el servidor.');
  }

  const schema = req.jsonSchema ?? (z.toJSONSchema(req.schema, { target: 'draft-7', io: 'output' }) as Record<string, unknown>);
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), req.params.timeoutMs ?? 180_000);

  // Entorno mínimo: sin ANTHROPIC_API_KEY para que nunca cobre por token; con el token de suscripción si existe.
  // USER/LOGNAME/HOME permiten leer el llavero de macOS cuando se usa el login local.
  const env: Record<string, string | undefined> = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    USER: process.env.USER,
    LOGNAME: process.env.LOGNAME,
    TMPDIR: process.env.TMPDIR,
    LANG: 'es_MX.UTF-8',
    CLAUDE_AGENT_SDK_CLIENT_APP: 'stenia/0.1',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1',
    ENABLE_CLAUDEAI_MCP_SERVERS: 'false',
    ...(req.oauthToken ? { CLAUDE_CODE_OAUTH_TOKEN: req.oauthToken } : {}),
  };

  const blocks = req.content ?? (req.messages ? toContentBlocks(req.messages) : null);
  const prompt: string | AsyncIterable<SDKUserMessage> = blocks
    ? (async function* () {
        yield { type: 'user' as const, message: { role: 'user' as const, content: blocks }, parent_tool_use_id: null };
      })()
    : (req.prompt ?? '');

  try {
    const stream = query({
      prompt,
      options: {
        model: req.modelId,
        systemPrompt: req.system,
        tools: [],
        allowedTools: [],
        disallowedTools: ['Agent', 'TaskStop'],
        skills: [],
        settingSources: [],
        mcpServers: {},
        maxTurns: 4,
        persistSession: false,
        permissionMode: 'dontAsk',
        cwd: sandbox(),
        env,
        outputFormat: { type: 'json_schema', schema },
        abortController: abort,
      },
    });
    let authError = false;
    for await (const message of stream) {
      if (message.type === 'assistant' && message.error && ['authentication_failed', 'oauth_org_not_allowed', 'billing_error'].includes(message.error)) {
        authError = true;
      }
      if (message.type !== 'result') continue;
      usage.inputTokens = (message.usage.input_tokens ?? 0) + (message.usage.cache_read_input_tokens ?? 0) + (message.usage.cache_creation_input_tokens ?? 0);
      usage.outputTokens = message.usage.output_tokens ?? 0;
      usage.cachedInputTokens = message.usage.cache_read_input_tokens ?? 0;
      if (message.subtype !== 'success') {
        return fail(authError ? AUTH_HINT : `Claude no completó la respuesta (${message.subtype}).`);
      }
      if (message.is_error) return fail(authError ? AUTH_HINT : message.result.slice(0, 300) || 'Error de Claude.');
      const raw = message.structured_output ?? safeJson(message.result);
      const parsed = req.schema.safeParse(raw);
      if (!parsed.success) {
        return fail(`Salida inválida: ${parsed.error.issues.slice(0, 3).map((i) => i.message).join('; ')}`);
      }
      return { ok: true, output: parsed.data, usage, modelId: req.modelId, latencyMs: elapsed(), text: message.result };
    }
    return fail(authError ? AUTH_HINT : 'Claude terminó sin resultado.');
  } catch (error) {
    if (abort.signal.aborted) return fail('Claude tardó demasiado en responder.');
    const text = error instanceof Error ? error.message : String(error);
    return fail(/auth|login|401|credential/i.test(text) ? AUTH_HINT : text.slice(0, 300));
  } finally {
    clearTimeout(timer);
  }
}

function safeJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}
