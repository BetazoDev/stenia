import { describe, expect, it } from 'vitest';

import { AiSettingsInput, chooseAiProfile, defaultSettingsFor, maskApiKey, workersAiAccountId, workersAiBaseUrl } from './settings';

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

describe('perfil de IA por cuenta', () => {
  const base = { mode: 'same' as const, ownerProvider: 'claude_code' as const, hasUsersProfile: false };
  it('la cuenta dueña siempre usa su perfil', () => {
    expect(chooseAiProfile({ ...base, isOwner: true })).toEqual({ scope: 'owner', disabled: null });
  });
  it('la suscripción de Claude nunca atiende a otras cuentas', () => {
    expect(chooseAiProfile({ ...base, isOwner: false })).toEqual({ scope: 'owner', disabled: 'subscription_owner_only' });
  });
  it('con API key, «igual que la mía» comparte el perfil', () => {
    expect(chooseAiProfile({ ...base, isOwner: false, ownerProvider: 'anthropic' })).toEqual({ scope: 'owner', disabled: null });
  });
  it('perfil propio para las demás cuentas, o sin IA si falta o está apagado', () => {
    expect(chooseAiProfile({ ...base, isOwner: false, mode: 'custom', hasUsersProfile: true })).toEqual({ scope: 'users', disabled: null });
    expect(chooseAiProfile({ ...base, isOwner: false, mode: 'custom', hasUsersProfile: false }).disabled).toBe('users_disabled');
    expect(chooseAiProfile({ ...base, isOwner: false, mode: 'off', hasUsersProfile: true }).disabled).toBe('users_disabled');
  });
  it('arma y lee la URL de Workers AI', () => {
    const url = workersAiBaseUrl(' abc123 ');
    expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/abc123/ai/v1');
    expect(workersAiAccountId(url)).toBe('abc123');
    expect(workersAiAccountId('https://otra.url/v1')).toBe('');
  });
});
