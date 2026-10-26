import 'server-only';

import {
  AiProvider,
  DEFAULT_MODELS,
  UsersAiMode,
  chooseAiProfile,
  decryptSecret,
  defaultSettingsFor,
  type AiScope,
  type AiSettingsInput,
  type AiTask,
} from '@stenia/ai';
import { aiSettings, aiUsage, user } from '@stenia/db';
import { eq, gte, sql } from 'drizzle-orm';

import { getConfig, setConfig } from './app-config';
import { getDb } from './db';
import { adminEmails, env } from './env';

export type StoredAiSettings = typeof aiSettings.$inferSelect;

/** Fila `default`: tu perfil (admin). Fila `users`: el perfil opcional de las demás cuentas. */
export const SCOPE_ROW_ID: Record<AiScope, string> = { owner: 'default', users: 'users' };

export async function loadAiSettings(scope: AiScope = 'owner'): Promise<StoredAiSettings | null> {
  const [row] = await getDb().select().from(aiSettings).where(eq(aiSettings.id, SCOPE_ROW_ID[scope])).limit(1);
  return row ?? null;
}

const USERS_MODE_KEY = 'ai_users_mode';

export async function getUsersAiMode(): Promise<UsersAiMode> {
  const parsed = UsersAiMode.safeParse(await getConfig(USERS_MODE_KEY));
  return parsed.success ? parsed.data : 'same';
}

export async function setUsersAiMode(mode: UsersAiMode) {
  await setConfig(USERS_MODE_KEY, mode);
}

/**
 * La cuenta dueña es una sola persona: el primer correo de ADMIN_EMAILS (otros admins usan el perfil de las demás
 * cuentas, así la suscripción de Claude nunca atiende a alguien más). Sin ADMIN_EMAILS se usa el rol admin.
 * `null` son tareas de sistema.
 */
export async function isOwnerAccount(userId: string | null): Promise<boolean> {
  if (!userId) return true;
  const [row] = await getDb().select({ role: user.role, email: user.email }).from(user).where(eq(user.id, userId)).limit(1);
  if (!row) return false;
  const owner = adminEmails()[0];
  return owner ? row.email.trim().toLowerCase() === owner : row.role === 'admin';
}

export type AiConfig = {
  scope: AiScope;
  /** Perfil que atiende la llamada (modelos, parámetros, proveedor, key). */
  row: StoredAiSettings | null;
  /** Perfil de la cuenta dueña: presupuesto, envío de fotos y registro de prompts aplican a todos. */
  owner: StoredAiSettings | null;
  provider: AiProvider;
  disabled: 'users_disabled' | 'subscription_owner_only' | null;
};

/** Elige el perfil de IA para una cuenta: la dueña usa el suyo; las demás, el de «otras cuentas». */
export async function resolveAiConfig(userId: string | null): Promise<AiConfig> {
  const owner = await loadAiSettings('owner');
  const ownerProvider = resolveProvider(owner, 'owner');
  const isOwner = await isOwnerAccount(userId);
  const [mode, users] = isOwner ? (['same', null] as const) : await Promise.all([getUsersAiMode(), loadAiSettings('users')]);
  const decision = chooseAiProfile({ isOwner, mode, ownerProvider, hasUsersProfile: Boolean(users) });
  const row = decision.scope === 'users' ? users : owner;
  return { scope: decision.scope, row, owner, provider: resolveProvider(row, decision.scope), disabled: decision.disabled };
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

/** `AI_PROVIDER` en el entorno sobrescribe el proveedor guardado de tu perfil (no el de las demás cuentas). */
export function resolveProvider(row: StoredAiSettings | null, scope: AiScope = 'owner'): AiProvider {
  if (scope === 'owner') {
    const fromEnv = AiProvider.safeParse(env().AI_PROVIDER);
    if (fromEnv.success) return fromEnv.data;
  }
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
export function resolveApiKey(row: StoredAiSettings | null, scope: AiScope = 'owner'): { apiKey: string; source: 'env' | 'stored' | 'subscription' } | null {
  const e = env();
  if (resolveProvider(row, scope) === 'claude_code') {
    const stored = row?.apiKeyEncrypted ? decryptSecret(row.apiKeyEncrypted, e.ENCRYPTION_KEY) : '';
    // Solo cuenta como token si lo es: una API key de otro proveedor guardada antes se ignora.
    if (stored.startsWith('sk-ant-oat')) return { apiKey: stored, source: 'stored' };
    return { apiKey: e.CLAUDE_CODE_OAUTH_TOKEN ?? '', source: e.CLAUDE_CODE_OAUTH_TOKEN ? 'env' : 'subscription' };
  }
  if (scope === 'owner' && e.AI_API_KEY) return { apiKey: e.AI_API_KEY, source: 'env' };
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
