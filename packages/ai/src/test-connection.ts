import { generateText } from 'ai';
import { z } from 'zod';

import { generateWithClaudeCode } from './claude-code';
import { describeAiError } from './errors';
import { estimateCostUsd } from './pricing';
import { pingPrompt } from './prompts';
import { resolveModel, type ModelConfig } from './provider';

export type ConnectionTestResult =
  | { ok: true; latencyMs: number; modelId: string; usage: { inputTokens: number; outputTokens: number }; costUsd: number }
  | { ok: false; latencyMs: number; modelId: string; message: string };

/** Llamada mínima al modelo para validar key, URL base y modelo. */
export async function testConnection(config: ModelConfig): Promise<ConnectionTestResult> {
  const startedAt = performance.now();
  if (config.provider === 'claude_code') {
    const result = await generateWithClaudeCode({
      modelId: config.modelId,
      oauthToken: config.apiKey,
      params: { temperature: 0, maxTokens: 64, timeoutMs: 90_000 },
      schema: z.object({ ok: z.boolean() }),
      system: 'Responde solo con el JSON pedido.',
      prompt: 'Devuelve {"ok": true}.',
    });
    return result.ok
      ? { ok: true, latencyMs: result.latencyMs, modelId: config.modelId, usage: { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens }, costUsd: 0 }
      : { ok: false, latencyMs: result.latencyMs, modelId: config.modelId, message: result.message };
  }
  try {
    const model = resolveModel(config);
    const { system, prompt } = pingPrompt.render({});
    const result = await generateText({
      model,
      system,
      prompt,
      maxOutputTokens: 16,
      temperature: 0,
      maxRetries: 0,
      timeout: 20_000,
    });
    const usage = {
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
    };
    return {
      ok: true,
      latencyMs: Math.round(performance.now() - startedAt),
      modelId: config.modelId,
      usage,
      costUsd: estimateCostUsd(config.modelId, usage).usd,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - startedAt),
      modelId: config.modelId,
      message: describeAiError(error),
    };
  }
}
