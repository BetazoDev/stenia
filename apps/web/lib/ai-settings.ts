import 'server-only';

import { AiProvider, DEFAULT_MODELS, decryptSecret, defaultSettingsFor, type AiSettingsInput, type AiTask } from '@stenia/ai';
import { aiSettings, aiUsage } from '@stenia/db';
import { eq, gte, sql } from 'drizzle-orm';

import { getDb } from './db';
import { env } from './env';

export type StoredAiSettings = typeof aiSettings.$inferSelect;

export async function loadAiSettings(): Promise<StoredAiSettings | null> {
  const [row] = await getDb().select().from(aiSettings).where(eq(aiSettings.id, 'default')).limit(1);
  return row ?? null;
}

export function settingsToInput(row: StoredAiSettings | null): AiSettingsInput {
  if (!row) return defaultSettingsFor('anthropic');
  return {
    provider: row.provider,
    baseUrl: row.baseUrl ?? '',
    models: row.models,
    params: row.params,
    monthlyBudgetUsd: row.monthlyBudgetUsd,
    sendPhotos: row.sendPhotos,
    logPrompts: row.logPrompts,
  };
}

/** `AI_PROVIDER` en el entorno sobrescribe el proveedor guardado. */
export function resolveProvider(row: StoredAiSettings | null): AiProvider {
  const fromEnv = AiProvider.safeParse(env().AI_PROVIDER);
  if (fromEnv.success) return fromEnv.data;
  return row?.provider ?? 'anthropic';
}

export function providerFromEnv(): AiProvider | null {
  const parsed = AiProvider.safeParse(env().AI_PROVIDER);
  return parsed.success ? parsed.data : null;
}

/**
 * `AI_API_KEY` en el entorno sobrescribe la key cifrada en la base. Con la suscripción de Claude la «key» es
 * opcional: un token de `claude setup-token` (guardado o en `CLAUDE_CODE_OAUTH_TOKEN`) o, si no hay, el login
 * local de Claude Code en el equipo del servidor.
 */
export function resolveApiKey(row: StoredAiSettings | null): { apiKey: string; source: 'env' | 'stored' | 'subscription' } | null {
  const e = env();
  if (resolveProvider(row) === 'claude_code') {
    const stored = row?.apiKeyEncrypted ? decryptSecret(row.apiKeyEncrypted, e.ENCRYPTION_KEY) : '';
    // Solo cuenta como token si lo es: una API key de otro proveedor guardada antes se ignora.
    if (stored.startsWith('sk-ant-oat')) return { apiKey: stored, source: 'stored' };
    return { apiKey: e.CLAUDE_CODE_OAUTH_TOKEN ?? '', source: e.CLAUDE_CODE_OAUTH_TOKEN ? 'env' : 'subscription' };
  }
  if (e.AI_API_KEY) return { apiKey: e.AI_API_KEY, source: 'env' };
  if (row?.apiKeyEncrypted) {
    return { apiKey: decryptSecret(row.apiKeyEncrypted, e.ENCRYPTION_KEY), source: 'stored' };
  }
  return null;
}

export function modelForTask(row: StoredAiSettings | null, provider: AiProvider, task: AiTask): string {
  const stored = row?.models[task]?.trim();
  if (stored) return stored;
  if (task === 'fallback') return row?.models.fast?.trim() || DEFAULT_MODELS[provider].fast;
  return DEFAULT_MODELS[provider][task];
}

export type UsageByTask = { task: string; calls: number; inputTokens: number; outputTokens: number; costUsd: number; unpriced: number };
export type MonthlyUsage = { byTask: UsageByTask[]; totalUsd: number; totalCalls: number; unpricedCalls: number; since: Date };

export async function getMonthlyUsage(): Promise<MonthlyUsage> {
  const since = new Date();
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);
  const rows = await getDb()
    .select({
      task: aiUsage.task,
      calls: sql<number>`count(*)::int`,
      inputTokens: sql<number>`coalesce(sum(${aiUsage.inputTokens}), 0)::int`,
      outputTokens: sql<number>`coalesce(sum(${aiUsage.outputTokens}), 0)::int`,
      costUsd: sql<number>`coalesce(sum(${aiUsage.costUsd}), 0)::float8`,
      unpriced: sql<number>`count(*) filter (where not ${aiUsage.priced})::int`,
    })
    .from(aiUsage)
    .where(gte(aiUsage.createdAt, since))
    .groupBy(aiUsage.task)
    .orderBy(aiUsage.task);
  return {
    byTask: rows,
    totalUsd: rows.reduce((acc, r) => acc + r.costUsd, 0),
    totalCalls: rows.reduce((acc, r) => acc + r.calls, 0),
    unpricedCalls: rows.reduce((acc, r) => acc + r.unpriced, 0),
    since,
  };
}

export type BudgetLevel = 'ok' | 'warn' | 'blocked';

/** 80% avisa; 100% bloquea llamadas no esenciales (sección 11 del PRD). */
export function budgetLevel(totalUsd: number, budgetUsd: number): { level: BudgetLevel; ratio: number } {
  if (budgetUsd <= 0) return { level: 'ok', ratio: 0 };
  const ratio = totalUsd / budgetUsd;
  if (ratio >= 1) return { level: 'blocked', ratio };
  if (ratio >= 0.8) return { level: 'warn', ratio };
  return { level: 'ok', ratio };
}
