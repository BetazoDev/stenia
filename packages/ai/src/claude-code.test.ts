import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const calls: { options: Record<string, unknown>; prompt: unknown }[] = [];
let nextMessages: unknown[] = [];

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: (params: { prompt: unknown; options: Record<string, unknown> }) => {
    calls.push(params);
    return (async function* () {
      for (const m of nextMessages) yield m;
    })();
  },
}));

const { generateWithClaudeCode, toContentBlocks } = await import('./claude-code');

const result = (extra: Record<string, unknown>) => ({
  type: 'result',
  subtype: 'success',
  is_error: false,
  result: '',
  usage: { input_tokens: 100, output_tokens: 40, cache_read_input_tokens: 20, cache_creation_input_tokens: 0 },
  ...extra,
});

describe('suscripción de Claude', () => {
  beforeEach(() => {
    calls.length = 0;
    vi.stubEnv('ANTHROPIC_API_KEY', 'no-debe-pasar');
  });

  it('pide JSON Schema, sin herramientas ni ajustes, y nunca pasa ANTHROPIC_API_KEY', async () => {
    nextMessages = [result({ structured_output: { ok: true } })];
    const r = await generateWithClaudeCode({ modelId: 'claude-haiku-5-5', oauthToken: 'sk-ant-oat01-prueba', params: { temperature: 0, maxTokens: 64 }, schema: z.object({ ok: z.boolean() }), system: 'sys', prompt: 'hola' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toEqual({ ok: true });
    const options = calls[0]?.options as Record<string, unknown> & { env: Record<string, string>; outputFormat: { type: string } };
    expect(options.tools).toEqual([]);
    expect(options.settingSources).toEqual([]);
    expect(options.persistSession).toBe(false);
    expect(options.outputFormat.type).toBe('json_schema');
    expect(options.env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(options.env.CLAUDE_CODE_OAUTH_TOKEN).toBe('sk-ant-oat01-prueba');
    expect(r.usage).toEqual({ inputTokens: 120, outputTokens: 40, cachedInputTokens: 20 });
  });

  it('rechaza una salida que no cumple el esquema', async () => {
    nextMessages = [result({ structured_output: { ok: 'sí' } })];
    const r = await generateWithClaudeCode({ modelId: 'm', params: { temperature: 0, maxTokens: 64 }, schema: z.object({ ok: z.boolean() }), system: 's', prompt: 'p' });
    expect(r.ok).toBe(false);
  });

  it('traduce un error de autenticación a una indicación clara', async () => {
    nextMessages = [{ type: 'assistant', error: 'authentication_failed', message: { content: [] } }, result({ subtype: 'error_during_execution', is_error: true })];
    const r = await generateWithClaudeCode({ modelId: 'm', params: { temperature: 0, maxTokens: 64 }, schema: z.object({ ok: z.boolean() }), system: 's', prompt: 'p' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/pnpm claude auth login/);
  });

  it('convierte texto e imágenes del AI SDK a bloques de mensajes', () => {
    const blocks = toContentBlocks([{ role: 'user', content: [{ type: 'text', text: 'Lee el ticket' }, { type: 'image', image: new Uint8Array([1, 2, 3]), mediaType: 'image/png' }] }]);
    expect(blocks).toEqual([
      { type: 'text', text: 'Lee el ticket' },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AQID' } },
    ]);
  });
});
