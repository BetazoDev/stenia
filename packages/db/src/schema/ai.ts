import { boolean, doublePrecision, index, integer, jsonb, pgEnum, pgTable, text } from 'drizzle-orm/pg-core';

import { createdAt, id, updatedAt } from './_shared';
import { user } from './auth';

export const aiProvider = pgEnum('ai_provider', ['anthropic', 'openai', 'google', 'openrouter', 'openai_compatible', 'claude_code', 'workers_ai']);

export type AiModelsJson = { planning: string; fast: string; vision: string; fallback: string };
export type AiTaskParamsJson = { temperature: number; maxTokens: number };
export type AiParamsJson = Record<'planning' | 'fast' | 'vision' | 'fallback', AiTaskParamsJson>;

/** Fila `default`: perfil de la cuenta dueña (admin). Fila `users`: perfil opcional para las demás cuentas. */
export const aiSettings = pgTable('ai_settings', {
  id: text('id').primaryKey().default('default'),
  provider: aiProvider('provider').notNull().default('anthropic'),
  baseUrl: text('base_url'),
  apiKeyEncrypted: text('api_key_encrypted'),
  apiKeyLast4: text('api_key_last4'),
  models: jsonb('models').$type<AiModelsJson>().notNull(),
  params: jsonb('params').$type<AiParamsJson>().notNull(),
  monthlyBudgetUsd: doublePrecision('monthly_budget_usd').notNull().default(20),
  sendPhotos: boolean('send_photos').notNull().default(false),
  logPrompts: boolean('log_prompts').notNull().default(false),
  updatedBy: text('updated_by'),
  updatedAt: updatedAt(),
});

export const aiUsage = pgTable(
  'ai_usage',
  {
    id: id(),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    /** Función que originó la llamada: connection_test, routine_generation, checkin_summary… */
    task: text('task').notNull(),
    provider: aiProvider('provider').notNull(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    cachedInputTokens: integer('cached_input_tokens').notNull().default(0),
    costUsd: doublePrecision('cost_usd').notNull().default(0),
    priced: boolean('priced').notNull().default(true),
    latencyMs: integer('latency_ms'),
    ok: boolean('ok').notNull().default(true),
    error: text('error'),
    createdAt: createdAt(),
  },
  (t) => [index('ai_usage_created_at_idx').on(t.createdAt)],
);

/** Registro opcional de prompts (sin datos personales) para depurar. */
export const aiPromptLog = pgTable('ai_prompt_log', {
  id: id(),
  usageId: text('usage_id').references(() => aiUsage.id, { onDelete: 'cascade' }),
  promptId: text('prompt_id').notNull(),
  promptVersion: integer('prompt_version').notNull(),
  system: text('system'),
  prompt: text('prompt').notNull(),
  response: text('response'),
  createdAt: createdAt(),
});
