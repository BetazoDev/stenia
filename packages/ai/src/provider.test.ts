import { describe, expect, it } from 'vitest';

import { workersAiRequestExtras } from './provider';

describe('workersAiRequestExtras', () => {
  it('apaga el razonamiento de Gemma 4', () => {
    expect(workersAiRequestExtras('@cf/google/gemma-4-26b-a4b-it')).toEqual({ chat_template_kwargs: { enable_thinking: false } });
  });

  it('no toca otros modelos', () => {
    expect(workersAiRequestExtras('@cf/openai/gpt-oss-120b')).toEqual({});
  });
});
