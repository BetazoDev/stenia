import { generateText, NoOutputGeneratedError, Output, type ModelMessage } from 'ai';
import type { z } from 'zod';

import { generateWithClaudeCode } from './claude-code';
import { describeAiError } from './errors';
import { resolveModel, type ModelConfig } from './provider';

export type CallParams = { temperature: number; maxTokens: number; timeoutMs?: number };

export type StructuredRequest<T> = {
  model: ModelConfig;
  params: CallParams;
  schema: z.ZodType<T>;
  system: string;
  prompt?: string;
  messages?: ModelMessage[];
  schemaName?: string;
};

export type StructuredUsage = { inputTokens: number; outputTokens: number; cachedInputTokens: number };

export type StructuredSuccess<T> = { ok: true; output: T; usage: StructuredUsage; modelId: string; latencyMs: number; text: string };
export type StructuredFailure = { ok: false; message: string; usage: StructuredUsage; modelId: string; latencyMs: number };

/**
 * Llamada con salida estructurada validada por zod. No lanza: devuelve éxito o fallo con uso y latencia para
 * registrar en `ai_usage`. Los reintentos por validación de negocio los hace quien llama.
 */
export async function generateStructured<T>(req: StructuredRequest<T>): Promise<StructuredSuccess<T> | StructuredFailure> {
  if (req.model.provider === 'claude_code') {
    return generateWithClaudeCode({
      modelId: req.model.modelId,
      oauthToken: req.model.apiKey,
      params: req.params,
      schema: req.schema,
      system: req.system,
      prompt: req.prompt,
      messages: req.messages,
    });
  }
  const started = performance.now();
  const empty: StructuredUsage = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 };
  try {
    const model = resolveModel(req.model);
    const common = {
      model,
      system: req.system,
      temperature: req.params.temperature,
      maxOutputTokens: req.params.maxTokens,
      maxRetries: 1,
      timeout: req.params.timeoutMs ?? 90_000,
      output: Output.object({ schema: req.schema, name: req.schemaName }),
    };
    const result = req.messages
      ? await generateText({ ...common, messages: req.messages })
      : await generateText({ ...common, prompt: req.prompt ?? '' });
    const usage: StructuredUsage = {
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      cachedInputTokens: result.usage.inputTokenDetails?.cacheReadTokens ?? 0,
    };
    const parsed = req.schema.safeParse(result.output);
    if (!parsed.success) {
      return {
        ok: false,
        message: `Salida inválida: ${parsed.error.issues.slice(0, 3).map((i) => i.message).join('; ')}`,
        usage,
        modelId: req.model.modelId,
        latencyMs: Math.round(performance.now() - started),
      };
    }
    return { ok: true, output: parsed.data, usage, modelId: req.model.modelId, latencyMs: Math.round(performance.now() - started), text: result.text };
  } catch (error) {
    const message = NoOutputGeneratedError.isInstance(error) ? 'El modelo no devolvió un JSON válido.' : describeAiError(error);
    return { ok: false, message, usage: empty, modelId: req.model.modelId, latencyMs: Math.round(performance.now() - started) };
  }
}
