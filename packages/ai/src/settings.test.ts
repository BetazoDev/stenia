import { describe, expect, it } from 'vitest';

import { AiSettingsInput, defaultSettingsFor, maskApiKey } from './settings';

describe('AiSettingsInput', () => {
  it('acepta la configuración por defecto de cada proveedor con modelos', () => {
    expect(AiSettingsInput.safeParse(defaultSettingsFor('anthropic')).success).toBe(true);
    expect(AiSettingsInput.safeParse(defaultSettingsFor('openai')).success).toBe(true);
  });

  it('exige URL base para el proveedor compatible con OpenAI', () => {
    const base = defaultSettingsFor('openai_compatible');
    const withModels = { ...base, models: { planning: 'm', fast: 'm', vision: 'm', fallback: '' } };
    expect(AiSettingsInput.safeParse(withModels).success).toBe(false);
    expect(AiSettingsInput.safeParse({ ...withModels, baseUrl: 'https://llm.local/v1' }).success).toBe(true);
  });
});

describe('maskApiKey', () => {
  it('solo revela los últimos 4 caracteres', () => {
    expect(maskApiKey('sk-ant-abcdef1234')).toBe('••••1234');
  });
});
