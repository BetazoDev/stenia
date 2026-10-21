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
