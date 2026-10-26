import 'server-only';

import { AI_FUNCTIONS, OWNER_ONLY_PROVIDERS, generateStructured, type AiFunction, type CallParams } from '@stenia/ai';
import { aiPromptLog } from '@stenia/db';
import type { ModelMessage } from '@stenia/ai';
import type { z } from 'zod';

import { bridgeGenerate, bridgeState, usesBridge } from './ai-bridge';
import { budgetLevel, getMonthlyUsage, modelForTask, resolveAiConfig, resolveApiKey, type AiConfig } from './ai-settings';
import { recordAiUsage } from './ai-usage';
import { getDb } from './db';

export type AiUnavailableReason = 'not_configured' | 'budget' | 'photos_disabled' | 'bridge_offline' | 'subscription_owner_only' | 'users_disabled';

export type AiResult<T> =
  | { ok: true; output: T; modelId: string }
  | { ok: false; reason: AiUnavailableReason | 'error'; message: string };

export type AiStatus = { available: boolean; reason: AiUnavailableReason | null; sendPhotos: boolean; budget: 'ok' | 'warn' | 'blocked' };

/**
 * ¿Hay IA para esta cuenta y función? La cuenta dueña usa su perfil; las demás, el de «otras cuentas».
 * Presupuesto, envío de fotos y registro de prompts salen siempre del perfil dueño.
 */
export async function aiStatus(fn?: AiFunction, userId: string | null = null): Promise<AiStatus> {
  return statusFor(await resolveAiConfig(userId), fn);
}

async function statusFor(config: AiConfig, fn?: AiFunction): Promise<AiStatus> {
  const sendPhotos = config.owner?.sendPhotos ?? false;
  if (config.disabled) return { available: false, reason: config.disabled, sendPhotos, budget: 'ok' };
  // En el servidor, la suscripción de Claude solo está disponible si la Mac del usuario está conectada al puente.
  if (usesBridge(config.provider)) {
    const state = await bridgeState();
    return { available: state.online, reason: state.online ? null : 'bridge_offline', sendPhotos, budget: 'ok' };
  }
  let key: ReturnType<typeof resolveApiKey> = null;
  try {
    key = resolveApiKey(config.row, config.scope);
  } catch {
    key = null;
  }
  const usage = await getMonthlyUsage();
  const budget = budgetLevel(usage.totalUsd, config.owner?.monthlyBudgetUsd ?? 20).level;
  if (!key) return { available: false, reason: 'not_configured', sendPhotos, budget };
  if (fn && budget === 'blocked' && !AI_FUNCTIONS[fn].essential) return { available: false, reason: 'budget', sendPhotos, budget };
  return { available: true, reason: null, sendPhotos, budget };
}

const UNAVAILABLE_MESSAGES: Record<AiUnavailableReason, string> = {
  not_configured: 'La IA no está configurada: un administrador debe cargar la API key en Configuración de desarrollador.',
  budget: 'Se alcanzó el presupuesto mensual de IA; esta función se reanuda el próximo mes.',
  photos_disabled: 'El envío de fotos al LLM está apagado en Configuración de desarrollador.',
  bridge_offline: 'Tu Mac no está conectada al puente de IA (pnpm ai:bridge); se usa la versión sin IA.',
  subscription_owner_only: 'La IA con suscripción de Claude solo está disponible para la cuenta dueña.',
  users_disabled: 'La IA no está habilitada para esta cuenta; se usan las versiones sin IA.',
};

/** Texto para la interfaz cuando una función de IA no está disponible. */
export function aiUnavailableMessage(reason: AiUnavailableReason | null): string | null {
  return reason ? UNAVAILABLE_MESSAGES[reason] : null;
}

/** Quita el contenido escrito por el usuario antes de guardar el prompt en el registro de depuración. */
function redact(text: string): string {
  return text.replace(/<datos_usuario([^>]*)>[\s\S]*?<\/datos_usuario>/g, '<datos_usuario$1>[redactado]</datos_usuario>');
}

export type RunAiArgs<T> = {
  fn: AiFunction;
  userId: string | null;
  schema: z.ZodType<T>;
  system: string;
  prompt?: string;
  messages?: ModelMessage[];
  promptId: string;
  promptVersion: number;
  /** Las llamadas con imágenes exigen el interruptor de fotos. */
  withImages?: boolean;
};

/**
 * Ejecuta una función de IA: verifica configuración y presupuesto, usa el modelo de la tarea, cae al modelo de
 * respaldo si falla y registra tokens y costo en `ai_usage` (y el prompt sin datos personales si está activo).
 */
export async function runAi<T>(args: RunAiArgs<T>): Promise<AiResult<T>> {
  const config = await resolveAiConfig(args.userId);
  const status = await statusFor(config, args.fn);
  if (!status.available && status.reason) return { ok: false, reason: status.reason, message: UNAVAILABLE_MESSAGES[status.reason] };
  const { row, provider } = config;
  if (args.withImages && !config.owner?.sendPhotos) {
    return { ok: false, reason: 'photos_disabled', message: UNAVAILABLE_MESSAGES.photos_disabled };
  }
  // Doble candado: la suscripción de Claude solo atiende al perfil dueño, vaya o no por el puente.
  if (OWNER_ONLY_PROVIDERS.includes(provider) && config.scope !== 'owner') {
    return { ok: false, reason: 'subscription_owner_only', message: UNAVAILABLE_MESSAGES.subscription_owner_only };
  }
  const bridged = usesBridge(provider);
  // Por el puente no hace falta key: la Mac usa su propio login de Claude.
  const key = bridged ? null : resolveApiKey(row, config.scope);
  if (!bridged && !key) return { ok: false, reason: 'not_configured', message: UNAVAILABLE_MESSAGES.not_configured };
  const task = AI_FUNCTIONS[args.fn].task;
  const params: CallParams = row?.params[task] ?? { temperature: 0.2, maxTokens: 4000 };
  const primary = modelForTask(row, provider, task);
  const fallback = row?.models.fallback?.trim() || null;
  const models = [primary, ...(fallback && fallback !== primary ? [fallback] : [])];

  let lastMessage = 'Error desconocido.';
  for (const modelId of models) {
    const callParams = modelId === primary ? params : (row?.params.fallback ?? params);
    const result = bridged
      ? await bridgeGenerate({ userId: args.userId, fn: args.fn, modelId, params: callParams, schema: args.schema, system: args.system, prompt: args.prompt, messages: args.messages })
      : await generateStructured({
          model: { provider, apiKey: key?.apiKey ?? '', modelId, baseUrl: row?.baseUrl ?? undefined },
          params: callParams,
          schema: args.schema,
          system: args.system,
          prompt: args.prompt,
          messages: args.messages,
          schemaName: args.promptId,
        });
    const usageId = await recordAiUsage({
      userId: args.userId,
      task: args.fn,
      provider,
      model: modelId,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      cachedInputTokens: result.usage.cachedInputTokens,
      latencyMs: result.latencyMs,
      ok: result.ok,
      error: result.ok ? null : result.message,
    });
    if (config.owner?.logPrompts) {
      await getDb()
        .insert(aiPromptLog)
        .values({
          usageId,
          promptId: args.promptId,
          promptVersion: args.promptVersion,
          system: redact(args.system),
          prompt: redact(args.prompt ?? '[mensajes con imagen]'),
          response: result.ok ? JSON.stringify(result.output).slice(0, 20_000) : result.message,
        })
        .catch(() => undefined);
    }
    if (result.ok) return { ok: true, output: result.output, modelId };
    lastMessage = result.message;
    // Si la Mac no contestó, el modelo de respaldo tampoco lo hará: no se duplica la espera.
    if (bridged && /no respondió|no está conectada/.test(result.message)) break;
  }
  return { ok: false, reason: 'error', message: lastMessage };
}
