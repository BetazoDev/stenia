import { generateText } from 'ai';

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
