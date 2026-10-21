'use server';

import {
  AiSettingsInput,
  AiTask,
  encryptSecret,
  testConnection,
  type ConnectionTestResult,
} from '@stenia/ai';
import { aiSettings } from '@stenia/db';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { approvePairing, bridgeGenerate, unpairBridge, usesBridge } from '@/lib/ai-bridge';
import { loadAiSettings, modelForTask, resolveApiKey, resolveProvider } from '@/lib/ai-settings';
import { recordAiUsage } from '@/lib/ai-usage';
import { getDb } from '@/lib/db';
import { env } from '@/lib/env';
import { requireAdmin } from '@/lib/session';

export type ActionResult = { ok: true; message?: string } | { ok: false; message: string };

const SaveInput = z.object({
  settings: AiSettingsInput,
  apiKey: z.string().trim().max(512).optional(),
});

export async function saveAiSettingsAction(raw: unknown): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = SaveInput.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, message: first ? `${first.path.join('.') || 'formulario'}: ${first.message}` : 'Datos inválidos' };
  }
  const { settings, apiKey } = parsed.data;

  let keyFields: { apiKeyEncrypted: string; apiKeyLast4: string } | null = null;
  if (apiKey) {
    const key = env().ENCRYPTION_KEY;
    if (!key) {
      return { ok: false, message: 'Falta ENCRYPTION_KEY en el servidor; no se puede guardar la API key cifrada.' };
    }
    try {
      keyFields = { apiKeyEncrypted: encryptSecret(apiKey, key), apiKeyLast4: apiKey.slice(-4) };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'No se pudo cifrar la API key.' };
    }
  }

  const values = {
    provider: settings.provider,
    baseUrl: settings.baseUrl ? settings.baseUrl : null,
    models: { ...settings.models, fallback: settings.models.fallback ?? '' },
    params: settings.params,
    monthlyBudgetUsd: settings.monthlyBudgetUsd,
    sendPhotos: settings.sendPhotos,
    logPrompts: settings.logPrompts,
    updatedBy: session.user.id,
    updatedAt: new Date(),
    ...(keyFields ?? {}),
  };

  await getDb()
    .insert(aiSettings)
    .values({ id: 'default', ...values })
    .onConflictDoUpdate({ target: aiSettings.id, set: values });

  revalidatePath('/settings/developer');
  return { ok: true, message: keyFields ? 'Configuración y API key guardadas.' : 'Configuración guardada.' };
}

export async function clearApiKeyAction(): Promise<ActionResult> {
  const session = await requireAdmin();
  await getDb()
    .update(aiSettings)
    .set({ apiKeyEncrypted: null, apiKeyLast4: null, updatedBy: session.user.id, updatedAt: new Date() })
    .where(eq(aiSettings.id, 'default'));
  revalidatePath('/settings/developer');
  return { ok: true, message: 'API key eliminada.' };
}

export async function testConnectionAction(rawTask: unknown): Promise<ConnectionTestResult> {
  const session = await requireAdmin();
  const task = AiTask.safeParse(rawTask);
  if (!task.success) return { ok: false, latencyMs: 0, modelId: '', message: 'Tarea no válida.' };

  const row = await loadAiSettings();
  const provider = resolveProvider(row);
  if (usesBridge(provider)) {
    const modelId = modelForTask(row, provider, task.data);
    const r = await bridgeGenerate({
      userId: session.user.id,
      fn: 'connection_test',
      modelId,
      params: { temperature: 0, maxTokens: 64, timeoutMs: 90_000 },
      schema: z.object({ ok: z.boolean() }),
      system: 'Responde solo con el JSON pedido.',
      prompt: 'Devuelve {"ok": true}.',
    });
    await recordAiUsage({ userId: session.user.id, task: 'connection_test', provider, model: modelId, inputTokens: r.usage.inputTokens, outputTokens: r.usage.outputTokens, latencyMs: r.latencyMs, ok: r.ok, error: r.ok ? null : r.message });
    revalidatePath('/settings/developer');
    return r.ok
      ? { ok: true, latencyMs: r.latencyMs, modelId, usage: { inputTokens: r.usage.inputTokens, outputTokens: r.usage.outputTokens }, costUsd: 0 }
      : { ok: false, latencyMs: r.latencyMs, modelId, message: r.message };
  }
  let key: ReturnType<typeof resolveApiKey>;
  try {
    key = resolveApiKey(row);
  } catch (error) {
    return { ok: false, latencyMs: 0, modelId: '', message: error instanceof Error ? error.message : 'No se pudo leer la API key.' };
  }
  if (!key) {
    return { ok: false, latencyMs: 0, modelId: '', message: 'No hay API key guardada ni AI_API_KEY en el entorno.' };
  }
  const modelId = modelForTask(row, provider, task.data);
  if (!modelId) {
    return { ok: false, latencyMs: 0, modelId: '', message: 'Indica un modelo para esta tarea antes de probar.' };
  }

  const result = await testConnection({ provider, apiKey: key.apiKey, modelId, baseUrl: row?.baseUrl ?? undefined });
  await recordAiUsage({
    userId: session.user.id,
    task: 'connection_test',
    provider,
    model: modelId,
    inputTokens: result.ok ? result.usage.inputTokens : 0,
    outputTokens: result.ok ? result.usage.outputTokens : 0,
    latencyMs: result.latencyMs,
    ok: result.ok,
    error: result.ok ? null : result.message,
  });
  revalidatePath('/settings/developer');
  return result;
}

const JobTypeInput = z.enum(['import_foods', 'import_exercises', 'translate_exercises_glossary', 'translate_exercises_ai', 'translate_foods_ai']);

export async function startJobAction(type: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = JobTypeInput.safeParse(type);
  if (!parsed.success) return { ok: false, message: 'Tarea desconocida.' };
  const { startJob } = await import('@/lib/jobs');
  const result = await startJob(parsed.data, session.user.id);
  revalidatePath('/settings/developer');
  return result.ok ? { ok: true } : { ok: false, message: result.message };
}

export async function approveBridgeAction(code: string): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.string().trim().min(4).max(12).safeParse(code);
  if (!parsed.success) return { ok: false, message: 'Escribe el código que muestra tu Mac.' };
  const result = await approvePairing(parsed.data);
  revalidatePath('/settings/developer');
  return result.ok ? { ok: true, message: `Mac vinculada: ${result.worker}.` } : result;
}

export async function unpairBridgeAction(): Promise<ActionResult> {
  await requireAdmin();
  await unpairBridge();
  revalidatePath('/settings/developer');
  return { ok: true };
}
