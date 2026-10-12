import { describe, expect, it } from 'vitest';

import { estimateCostUsd, findModelPrice } from './pricing';

describe('estimateCostUsd', () => {
  it('calcula el costo de una generación de rutina de referencia (15k entrada, 4k salida)', () => {
    const { usd, priced } = estimateCostUsd('claude-opus-5-5', { inputTokens: 15_000, outputTokens: 4_000 });
    expect(priced).toBe(true);
    expect(usd).toBeCloseTo(0.14, 2);
  });

  it('descuenta tokens cacheados cuando el modelo tiene tarifa de caché', () => {
    const full = estimateCostUsd('claude-sonnet-5-5', { inputTokens: 10_000, outputTokens: 0 });
    const cached = estimateCostUsd('claude-sonnet-5-5', {
      inputTokens: 10_000,
      outputTokens: 0,
      cachedInputTokens: 10_000,
    });
    expect(cached.usd).toBeLessThan(full.usd);
  });

  it('marca como no tarificado un modelo desconocido', () => {
    expect(estimateCostUsd('modelo-inventado', { inputTokens: 1, outputTokens: 1 })).toEqual({
      usd: 0,
      priced: false,
    });
  });

  it('resuelve prefijos de proveedor y puntos en el nombre', () => {
    expect(findModelPrice('anthropic/claude-sonnet-5.5')).toBeDefined();
    expect(findModelPrice('openai/gpt-6-luna')).toBeDefined();
  });
});
