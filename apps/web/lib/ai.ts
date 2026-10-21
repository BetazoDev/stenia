import 'server-only';

import { AI_FUNCTIONS, generateStructured, type AiFunction, type CallParams } from '@stenia/ai';
import { aiPromptLog } from '@stenia/db';
import type { ModelMessage } from '@stenia/ai';
import type { z } from 'zod';

import { bridgeGenerate, bridgeState, isSubscriptionOwner, usesBridge } from './ai-bridge';
import { budgetLevel, getMonthlyUsage, loadAiSettings, modelForTask, resolveApiKey, resolveProvider } from './ai-settings';
import { recordAiUsage } from './ai-usage';
import { getDb } from './db';

export type AiUnavailableReason = 'not_configured' | 'budget' | 'photos_disabled' | 'bridge_offline' | 'subscription_owner_only';

export type AiResult<T> =
  | { ok: true; output: T; modelId: string }
  | { ok: false; reason: AiUnavailableReason | 'error'; message: string };

export type AiStatus = { available: boolean; reason: AiUnavailableReason | null; sendPhotos: boolean; budget: 'ok' | 'warn' | 'blocked' };

/** ¿Hay proveedor y key configurados, y presupuesto para esta función? */
export async function aiStatus(fn?: AiFunction): Promise<AiStatus> {
  const row = await loadAiSettings();
  // En el servidor, la suscripción de Claude solo está disponible si la Mac del usuario está conectada al puente.
  if (usesBridge(resolveProvider(row))) {
    const state = await bridgeState();
    return { available: state.online, reason: state.online ? null : 'bridge_offline', sendPhotos: row?.sendPhotos ?? false, budget: 'ok' };
  }
  let key: ReturnType<typeof resolveApiKey> = null;
  try {
    key = resolveApiKey(row);
  } catch {
    key = null;
  }
  const usage = await getMonthlyUsage();
  const budget = budgetLevel(usage.totalUsd, row?.monthlyBudgetUsd ?? 20).level;
  const sendPhotos = row?.sendPhotos ?? false;
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
  const status = await aiStatus(args.fn);
  if (!status.available && status.reason) return { ok: false, reason: status.reason, message: UNAVAILABLE_MESSAGES[status.reason] };
  const row = await loadAiSettings();
  if (args.withImages && !row?.sendPhotos) {
    return { ok: false, reason: 'photos_disabled', message: UNAVAILABLE_MESSAGES.photos_disabled };
  }
  const key = resolveApiKey(row);
  if (!key) return { ok: false, reason: 'not_configured', message: UNAVAILABLE_MESSAGES.not_configured };
  const provider = resolveProvider(row);
  const task = AI_FUNCTIONS[args.fn].task;
  const params: CallParams = row?.params[task] ?? { temperature: 0.2, maxTokens: 4000 };
  const primary = modelForTask(row, provider, task);
  const fallback = row?.models.fallback?.trim() || null;
  const models = [primary, ...(fallback && fallback !== primary ? [fallback] : [])];
  const bridged = usesBridge(provider);
  if (bridged && !(await isSubscriptionOwner(args.userId))) {
    return { ok: false, reason: 'subscription_owner_only', message: UNAVAILABLE_MESSAGES.subscription_owner_only };
  }

  let lastMessage = 'Error desconocido.';
  for (const modelId of models) {
    const callParams = modelId === primary ? params : (row?.params.fallback ?? params);
    const result = bridged
      ? await bridgeGenerate({ userId: args.userId, fn: args.fn, modelId, params: callParams, schema: args.schema, system: args.system, prompt: args.prompt, messages: args.messages })
      : await generateStructured({
          model: { provider, apiKey: key.apiKey, modelId, baseUrl: row?.baseUrl ?? undefined },
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
    if (row?.logPrompts) {
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
