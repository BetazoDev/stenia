import { z } from 'zod';

export const AiProvider = z.enum(['anthropic', 'openai', 'google', 'openrouter', 'openai_compatible', 'claude_code', 'workers_ai']);
export type AiProvider = z.infer<typeof AiProvider>;

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  openrouter: 'OpenRouter',
  openai_compatible: 'Compatible con OpenAI (URL base propia)',
  claude_code: 'Suscripción de Claude (tu Mac, sin costo por token)',
  workers_ai: 'Cloudflare Workers AI (gratis hasta el límite diario)',
};

/** Proveedores que no cobran por token (suscripción, o asignación gratuita diaria de Workers AI). */
export const SUBSCRIPTION_PROVIDERS: readonly AiProvider[] = ['claude_code', 'workers_ai'];

/** Proveedores que solo puede usar la cuenta dueña (términos de la suscripción de Claude). */
export const OWNER_ONLY_PROVIDERS: readonly AiProvider[] = ['claude_code'];

/** URL base de Workers AI (compatible con OpenAI) a partir del ID de cuenta de Cloudflare. */
export function workersAiBaseUrl(accountId: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId.trim()}/ai/v1`;
}

export function workersAiAccountId(baseUrl: string | null | undefined): string {
  return baseUrl?.match(/\/accounts\/([^/]+)\/ai\/v1/)?.[1] ?? '';
}

/** Lo que alguien escribe o pega como ID de cuenta: acepta la URL completa y deja solo letras y números. */
export function normalizeWorkersAiAccountId(input: string): string {
  const fromUrl = input.match(/\/accounts\/([^/\s]+)/)?.[1];
  return (fromUrl ?? input).toLowerCase().replace(/[^a-z0-9]/g, '');
}

export const WORKERS_AI_ACCOUNT_ID = /^[a-f0-9]{32}$/;

/** Perfiles de IA: el de la cuenta dueña (admin) y el de las demás cuentas. */
export const AiScope = z.enum(['owner', 'users']);
export type AiScope = z.infer<typeof AiScope>;

/** Las demás cuentas usan la misma configuración que la dueña, una propia, o ninguna IA. */
export const UsersAiMode = z.enum(['same', 'custom', 'off']);
export type UsersAiMode = z.infer<typeof UsersAiMode>;

export const USERS_AI_MODE_LABELS: Record<UsersAiMode, { label: string; help: string }> = {
  same: { label: 'Igual que la mía', help: 'Usan tu proveedor y tu key (no aplica con la suscripción de Claude).' },
  custom: { label: 'Proveedor propio', help: 'Por ejemplo Workers AI gratis u OpenRouter; tú lo configuras una vez.' },
  off: { label: 'Sin IA', help: 'Usan las versiones por reglas: plantillas de rutina y plan, revisiones por reglas.' },
};

export type AiProfileDecision =
  | { scope: AiScope; disabled: null }
  | { scope: AiScope; disabled: 'users_disabled' | 'subscription_owner_only' };

/** Qué perfil atiende a una cuenta. La suscripción de Claude nunca sirve a otras cuentas. */
export function chooseAiProfile(input: { isOwner: boolean; mode: UsersAiMode; ownerProvider: AiProvider; hasUsersProfile: boolean }): AiProfileDecision {
  if (input.isOwner) return { scope: 'owner', disabled: null };
  if (input.mode === 'off') return { scope: 'users', disabled: 'users_disabled' };
  if (input.mode === 'custom') return input.hasUsersProfile ? { scope: 'users', disabled: null } : { scope: 'users', disabled: 'users_disabled' };
  if (OWNER_ONLY_PROVIDERS.includes(input.ownerProvider)) return { scope: 'owner', disabled: 'subscription_owner_only' };
  return { scope: 'owner', disabled: null };
}

/** Tareas con modelo configurable (sección 11 del PRD). */
export const AiTask = z.enum(['planning', 'fast', 'vision', 'fallback']);
export type AiTask = z.infer<typeof AiTask>;

export const AI_TASK_LABELS: Record<AiTask, { label: string; help: string }> = {
  planning: { label: 'Planificación', help: 'Rutina, plan de comidas y análisis de revisiones' },
  fast: { label: 'Rápido', help: 'Meta de hoy, resumen de sesión y sustituciones' },
  vision: { label: 'Visión', help: 'Lectura del ticket de InBody y fotos (si se habilita)' },
  fallback: { label: 'Respaldo', help: 'Se usa si el principal falla o excede el tiempo' },
};

export const TaskParams = z.object({
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().min(64).max(64_000),
});
export type TaskParams = z.infer<typeof TaskParams>;

export const AiModels = z.object({
  planning: z.string().trim().min(1, 'Indica un modelo de planificación'),
  fast: z.string().trim().min(1, 'Indica un modelo rápido'),
  vision: z.string().trim().min(1, 'Indica un modelo con visión'),
  fallback: z.string().trim().optional().default(''),
});
export type AiModels = z.infer<typeof AiModels>;

export const AiParams = z.object({
  planning: TaskParams,
  fast: TaskParams,
  vision: TaskParams,
  fallback: TaskParams,
});
export type AiParams = z.infer<typeof AiParams>;

export const AiSettingsInput = z
  .object({
    provider: AiProvider,
    baseUrl: z.string().trim().url('La URL base no es válida (revisa que el navegador no la haya autocompletado)').optional().or(z.literal('')),
    models: AiModels,
    params: AiParams,
    monthlyBudgetUsd: z.number().min(0).max(10_000),
    sendPhotos: z.boolean(),
    logPrompts: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.provider === 'workers_ai') {
      const accountId = workersAiAccountId(value.baseUrl);
      if (!WORKERS_AI_ACCOUNT_ID.test(accountId) || value.baseUrl !== workersAiBaseUrl(accountId)) {
        ctx.addIssue({ code: 'custom', path: ['baseUrl'], message: 'El ID de cuenta de Cloudflare debe tener 32 caracteres hexadecimales' });
      }
    }
    if (value.provider === 'openai_compatible' && !value.baseUrl) {
      ctx.addIssue({
        code: 'custom',
        path: ['baseUrl'],
        message: 'El proveedor compatible con OpenAI necesita una URL base',
      });
    }
  });
export type AiSettingsInput = z.infer<typeof AiSettingsInput>;

export const DEFAULT_PARAMS: AiParams = {
  planning: { temperature: 0.2, maxTokens: 8_000 },
  fast: { temperature: 0.4, maxTokens: 1_500 },
  vision: { temperature: 0.1, maxTokens: 2_000 },
  fallback: { temperature: 0.2, maxTokens: 8_000 },
};

/** Modelos sugeridos por proveedor (editables en la pantalla de desarrollador). */
export const DEFAULT_MODELS: Record<AiProvider, AiModels> = {
  anthropic: {
    planning: 'claude-opus-5-5',
    fast: 'claude-haiku-5-5',
    vision: 'claude-sonnet-5-5',
    fallback: 'claude-sonnet-5-5',
  },
  openai: { planning: 'gpt-6.1-sol', fast: 'gpt-6-luna', vision: 'gpt-6.1-sol', fallback: 'gpt-6-luna' },
  google: {
    planning: 'gemini-3.1-pro-preview',
    fast: 'gemini-3.8-flash',
    vision: 'gemini-3.8-flash',
    fallback: 'gemini-3.8-flash',
  },
  openrouter: {
    planning: 'anthropic/claude-sonnet-5.5',
    fast: 'anthropic/claude-haiku-5.5',
    vision: 'anthropic/claude-sonnet-5.5',
    fallback: 'openai/gpt-6-luna',
  },
  openai_compatible: { planning: '', fast: '', vision: '', fallback: '' },
  // Evaluado 2026-10-22: Gemma 4 sin «thinking» pasó rutina, plan, revisión y traducción en dos corridas; gpt-oss
  // falló rutina y plan, pero sirve de respaldo en las tareas cortas.
  workers_ai: {
    planning: '@cf/google/gemma-4-26b-a4b-it',
    fast: '@cf/google/gemma-4-26b-a4b-it',
    vision: '@cf/google/gemma-4-26b-a4b-it',
    fallback: '@cf/openai/gpt-oss-120b',
  },
  // Sonnet para planificar porque Opus no está en todos los planes; con Max puede cambiarse a claude-opus-5-5.
  claude_code: {
    planning: 'claude-sonnet-5-5',
    fast: 'claude-haiku-5-5',
    vision: 'claude-sonnet-5-5',
    fallback: 'claude-haiku-5-5',
  },
};

export function defaultSettingsFor(provider: AiProvider): AiSettingsInput {
  return {
    provider,
    baseUrl: '',
    models: DEFAULT_MODELS[provider],
    params: DEFAULT_PARAMS,
    monthlyBudgetUsd: 20,
    sendPhotos: false,
    logPrompts: false,
  };
}

/** Muestra solo los últimos 4 caracteres de una key. */
export function maskApiKey(key: string): string {
  const last4 = key.slice(-4);
  return `••••${last4}`;
}
