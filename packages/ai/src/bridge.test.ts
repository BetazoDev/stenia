import { describe, expect, it } from 'vitest';

import { BridgeJob, BridgeResult, PairRequest, bridgeTokenMatches, hashBridgeToken, newBridgeToken, newPairingCode } from './bridge';

describe('puente de IA', () => {
  it('genera códigos legibles sin caracteres ambiguos', () => {
    for (let i = 0; i < 50; i += 1) {
      const code = newPairingCode();
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
      expect(PairRequest.safeParse({ code, tokenHash: hashBridgeToken('x'), worker: 'Mac' }).success).toBe(true);
    }
  });

  it('acepta solo el token cuyo hash está guardado', () => {
    const token = newBridgeToken();
    const stored = hashBridgeToken(token);
    expect(token.startsWith('stb_')).toBe(true);
    expect(bridgeTokenMatches(token, stored)).toBe(true);
    expect(bridgeTokenMatches(newBridgeToken(), stored)).toBe(false);
    expect(bridgeTokenMatches(null, stored)).toBe(false);
    expect(bridgeTokenMatches(token, null)).toBe(false);
    expect(bridgeTokenMatches(token, 'no-es-hex')).toBe(false);
  });

  it('valida trabajos y resultados', () => {
    const job = {
      id: 'r1',
      fn: 'inbody_extraction',
      modelId: 'claude-sonnet-5-5',
      system: 's',
      prompt: null,
      content: [
        { type: 'text', text: 'Lee el ticket' },
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } },
      ],
      jsonSchema: { type: 'object' },
      params: { temperature: 0.1, maxTokens: 2000, timeoutMs: 160_000 },
    };
    expect(BridgeJob.safeParse(job).success).toBe(true);
    expect(BridgeJob.safeParse({ ...job, content: [{ type: 'image', source: { type: 'url', url: 'http://x' } }] }).success).toBe(false);
    expect(BridgeResult.safeParse({ id: 'r1', ok: true, output: { a: 1 }, modelId: 'm', latencyMs: 10, usage: { inputTokens: 1, outputTokens: 1, cachedInputTokens: 0 } }).success).toBe(true);
    expect(BridgeResult.safeParse({ id: 'r1', ok: true, modelId: 'm', latencyMs: -1, usage: { inputTokens: 1, outputTokens: 1, cachedInputTokens: 0 } }).success).toBe(false);
  });
});
