/**
 * Precios de referencia en USD por millón de tokens (entrada / salida), consultados el 12 oct 2026
 * (sección 11 del PRD). Se usan para estimar costo por llamada; un modelo desconocido se registra
 * con costo 0 y `priced: false` para que el panel lo señale.
 */
export type ModelPrice = { input: number; output: number; cachedInput?: number };

export const MODEL_PRICES: Record<string, ModelPrice> = {
  'claude-opus-5-5': { input: 4, output: 20, cachedInput: 0.4 },
  'claude-sonnet-5-5': { input: 2, output: 10, cachedInput: 0.2 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cachedInput: 0.01 },
  'gpt-6.1-sol': { input: 2, output: 10 },
  'gpt-6-luna': { input: 0.1, output: 0.5 },
  'gpt-6-astra': { input: 10, output: 50 },
  'gemini-3.1-pro-preview': { input: 2, output: 12 },
  'gemini-3.8-flash': { input: 0.75, output: 3.75 },
  // Workers AI (Cloudflare): referencia si se pasa del plan gratuito; con el plan gratuito no hay cargo.
  'gpt-oss-120b': { input: 0.35, output: 0.75 },
  'gpt-oss-20b': { input: 0.2, output: 0.3 },
  'gemma-4-26b-a4b-it': { input: 0.1, output: 0.3 },
};

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
};

export type CostEstimate = { usd: number; priced: boolean };

/** Busca el precio quitando prefijos de proveedor (p. ej. `anthropic/claude-sonnet-5.5`) y sufijos de fecha. */
export function findModelPrice(modelId: string): ModelPrice | undefined {
  const bare = modelId.split('/').pop() ?? modelId;
  const direct = MODEL_PRICES[bare];
  if (direct) return direct;
  const normalized = bare.replaceAll('.', '-');
  if (MODEL_PRICES[normalized]) return MODEL_PRICES[normalized];
  const withoutDate = normalized.replace(/-\d{8}$/, '').replace(/-latest$/, '');
  return MODEL_PRICES[withoutDate];
}

export function estimateCostUsd(modelId: string, usage: TokenUsage): CostEstimate {
  const price = findModelPrice(modelId);
  if (!price) return { usd: 0, priced: false };
  const cached = usage.cachedInputTokens ?? 0;
  const freshInput = Math.max(0, usage.inputTokens - cached);
  const cachedRate = price.cachedInput ?? price.input;
  const usd =
    (freshInput * price.input + cached * cachedRate + usage.outputTokens * price.output) / 1_000_000;
  return { usd: Math.round(usd * 1_000_000) / 1_000_000, priced: true };
}
