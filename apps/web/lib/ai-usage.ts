import 'server-only';

import { estimateCostUsd, type AiProvider } from '@stenia/ai';
import { aiUsage } from '@stenia/db';

import { getDb } from './db';

export type RecordUsageInput = {
  userId: string | null;
  task: string;
  provider: AiProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  latencyMs: number;
  ok: boolean;
  error?: string | null;
};

/** Registra tokens y costo estimado de cada llamada al LLM (tabla `ai_usage`). */
export async function recordAiUsage(input: RecordUsageInput): Promise<void> {
  const cost = estimateCostUsd(input.model, {
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    cachedInputTokens: input.cachedInputTokens ?? 0,
  });
  await getDb().insert(aiUsage).values({
    userId: input.userId,
    task: input.task,
    provider: input.provider,
    model: input.model,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    cachedInputTokens: input.cachedInputTokens ?? 0,
    costUsd: cost.usd,
    priced: cost.priced,
    latencyMs: input.latencyMs,
    ok: input.ok,
    error: input.error ?? null,
  });
}
