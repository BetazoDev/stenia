import { z } from 'zod';

export const AiProvider = z.enum(['anthropic', 'openai', 'google', 'openrouter', 'openai_compatible', 'claude_code']);
export type AiProvider = z.infer<typeof AiProvider>;

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  openrouter: 'OpenRouter',
  openai_compatible: 'Compatible con OpenAI (URL base propia)',
  claude_code: 'Suscripción de Claude (tu Mac, sin costo por token)',
};

/** Proveedores que no cobran por token (usan los límites de una suscripción). */
export const SUBSCRIPTION_PROVIDERS: readonly AiProvider[] = ['claude_code'];

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
