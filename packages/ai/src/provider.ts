import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';

import type { AiProvider } from './settings';

export type ModelConfig = {
  provider: AiProvider;
  apiKey: string;
  modelId: string;
  baseUrl?: string | undefined;
  /** Solo compatible con OpenAI: el endpoint acepta `response_format: json_schema` (si no, se usa json_object). */
  structuredOutputs?: boolean | undefined;
  /** Solo compatible con OpenAI: cabeceras extra (p. ej. `cf-aig-gateway-id` en Workers AI). */
  headers?: Record<string, string> | undefined;
};

/**
 * Workers AI acepta `response_format: json_schema`. Confirmado con scripts/eval-ai.ts (2026-10-22): sin el esquema
 * (json_object) ningún modelo respetó la forma pedida.
 */
export const WORKERS_AI_JSON_SCHEMA = true;

/**
 * Campos extra por modelo en Workers AI. Gemma 4 razona por defecto y en tareas largas (rutina, plan) gastaba todo el
 * límite de tokens pensando sin llegar al JSON; sin «thinking» entrega rutinas válidas con un tercio de las neuronas.
 */
export function workersAiRequestExtras(modelId: string): Record<string, unknown> {
  if (modelId.startsWith('@cf/google/gemma-4')) return { chat_template_kwargs: { enable_thinking: false } };
  return {};
}

/** Construye el modelo del Vercel AI SDK para el proveedor elegido. Solo se llama desde el servidor. */
export function resolveModel(config: ModelConfig): LanguageModel {
  const baseURL = config.baseUrl?.trim() || undefined;
  switch (config.provider) {
    case 'anthropic':
      return createAnthropic({ apiKey: config.apiKey, baseURL })(config.modelId);
    case 'openai':
      return createOpenAI({ apiKey: config.apiKey, baseURL })(config.modelId);
    case 'google':
      return createGoogleGenerativeAI({ apiKey: config.apiKey, baseURL })(config.modelId);
    case 'openrouter':
      return createOpenRouter({ apiKey: config.apiKey, baseURL })(config.modelId);
    case 'workers_ai': {
      if (!baseURL) throw new Error('Workers AI necesita el ID de cuenta de Cloudflare.');
      return createOpenAICompatible({
        name: 'workers-ai',
        apiKey: config.apiKey,
        baseURL,
        supportsStructuredOutputs: config.structuredOutputs ?? WORKERS_AI_JSON_SCHEMA,
        transformRequestBody: (body) => ({ ...workersAiRequestExtras(config.modelId), ...body }),
        ...(config.headers ? { headers: config.headers } : {}),
      })(config.modelId);
    }
    case 'claude_code':
      throw new Error('La suscripción de Claude no usa el AI SDK: se llama con generateWithClaudeCode().');
    case 'openai_compatible': {
      if (!baseURL) throw new Error('El proveedor compatible con OpenAI necesita una URL base.');
      return createOpenAICompatible({
        name: 'openai-compatible',
        apiKey: config.apiKey,
        baseURL,
        supportsStructuredOutputs: config.structuredOutputs ?? false,
        ...(config.headers ? { headers: config.headers } : {}),
      })(config.modelId);
    }
  }
}
