import 'server-only';

import { SUBSCRIPTION_PROVIDERS, estimateCostUsd, type AiProvider } from '@stenia/ai';
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
export async function recordAiUsage(input: RecordUsageInput): Promise<string | null> {
  // Con suscripción no hay costo por token: se registran los tokens y el costo queda en cero.
  const cost = SUBSCRIPTION_PROVIDERS.includes(input.provider as AiProvider)
    ? { usd: 0, priced: true }
    : estimateCostUsd(input.model, {
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        cachedInputTokens: input.cachedInputTokens ?? 0,
      });
  const [row] = await getDb().insert(aiUsage).values({
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
  }).returning({ id: aiUsage.id });
  return row?.id ?? null;
}
