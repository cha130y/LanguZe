import type {
  GenerateContentParameters,
  GenerateContentResponse,
} from '@google/genai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkedItems } from '../../vocabulary/extraction-rules.js';
import { AiProviderError } from '../ai-provider.js';
import { GeminiAiProvider, type GeminiModels } from './gemini-ai-provider.js';

const photo = { data: Buffer.from('a photo'), contentType: 'image/jpeg' };

const settings = {
  safetyModel: 'safety-model',
  extractionModel: 'extraction-model',
  timeoutMs: 30_000,
};

/** A stand-in for the SDK: whatever the test says Gemini answered. */
function gemini(answer: Partial<GenerateContentResponse> | Error) {
  const generateContent = vi.fn(() =>
    answer instanceof Error
      ? Promise.reject(answer)
      : Promise.resolve(answer as GenerateContentResponse),
  );
  const models = { generateContent } as unknown as GeminiModels;
  return {
    provider: new GeminiAiProvider(models, settings),
    generateContent,
  };
}

const answering = (
  body: unknown,
  extra: Partial<GenerateContentResponse> = {},
) =>
  ({
    text: JSON.stringify(body),
    usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 120 },
    ...extra,
  }) as Partial<GenerateContentResponse>;

const requestOf = (generateContent: ReturnType<typeof vi.fn>) =>
  generateContent.mock.calls[0][0] as GenerateContentParameters;

const item = (overrides: Record<string, unknown> = {}) => ({
  english: 'sofa',
  thaiMeaning: 'โซฟา',
  exampleSentence: 'We sit on the sofa.',
  cefrLevel: 'A1',
  acceptedVariants: ['couch'],
  // [ymin, xmin, ymax, xmax], 0 to 1000 (ADR-0004).
  box: [100, 200, 500, 600],
  ...overrides,
});

beforeEach(() => vi.clearAllMocks());

describe('the safety check (FR-092)', () => {
  it('allows a photo Gemini allows', async () => {
    const { provider } = gemini(answering({ allowed: true }));

    const { value, usage } = await provider.checkPhoto(photo);

    expect(value).toEqual({ allowed: true });
    expect(usage).toEqual({ inputTokens: 900, outputTokens: 120 });
  });

  it('blocks with the category Gemini chose', async () => {
    const { provider } = gemini(
      answering({ allowed: false, category: 'VIOLENCE' }),
    );

    expect((await provider.checkPhoto(photo)).value).toEqual({
      allowed: false,
      category: 'VIOLENCE',
    });
  });

  it('falls back to OTHER for a category LanguZe does not know', async () => {
    const { provider } = gemini(
      answering({ allowed: false, category: 'SOMETHING_ELSE' }),
    );

    expect((await provider.checkPhoto(photo)).value).toEqual({
      allowed: false,
      category: 'OTHER',
    });
  });

  /* ADR-0004: a photo Gemini's own filters refuse is one LanguZe should not keep. */
  it('treats Gemini refusing to look as a block', async () => {
    const { provider } = gemini(
      answering({}, {
        promptFeedback: {
          blockReason: 'SAFETY',
          safetyRatings: [
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', blocked: true },
          ],
        },
      } as Partial<GenerateContentResponse>),
    );

    expect((await provider.checkPhoto(photo)).value).toEqual({
      allowed: false,
      category: 'SEXUAL_CONTENT',
    });
  });

  it('blocks as OTHER when the refusal names no category', async () => {
    const { provider } = gemini(
      answering({}, {
        promptFeedback: { blockReason: 'OTHER' },
      } as Partial<GenerateContentResponse>),
    );

    expect((await provider.checkPhoto(photo)).value).toEqual({
      allowed: false,
      category: 'OTHER',
    });
  });

  it('asks the safety model, with the photo and fixed instructions only', async () => {
    const { provider, generateContent } = gemini(answering({ allowed: true }));

    await provider.checkPhoto(photo);

    const request = requestOf(generateContent);
    expect(request.model).toBe('safety-model');
    const sent = JSON.stringify(request);
    expect(sent).toContain(photo.data.toString('base64'));
    // Nothing about the learner may travel with a photo (AIR-006).
    expect(sent).not.toMatch(/email|learner|@/i);
  });

  it('refuses an answer that gives no verdict', async () => {
    const { provider } = gemini(answering({ category: 'VIOLENCE' }));

    await expect(provider.checkPhoto(photo)).rejects.toMatchObject({
      code: 'INVALID_OUTPUT',
    });
  });
});

describe('extraction (AIR-003, ADR-0004)', () => {
  it('turns Gemini’s boxes into LanguZe’s', async () => {
    const { provider } = gemini(answering({ items: [item()] }));

    const { value } = await provider.extractVocabulary(photo);

    // [100, 200, 500, 600] of 1000 is x 0.2, y 0.1, width 0.4, height 0.4.
    expect(value[0].box).toEqual({
      x: 0.2,
      y: 0.1,
      width: 0.4,
      height: 0.4,
    });
  });

  it('produces items the vocabulary rules accept', async () => {
    const { provider } = gemini(answering({ items: [item()] }));

    const { value } = await provider.extractVocabulary(photo);

    expect(checkedItems(value)).toHaveLength(1);
  });

  it('asks the extraction model and reports what it cost', async () => {
    const { provider, generateContent } = gemini(
      answering({ items: [item()] }),
    );

    const { usage } = await provider.extractVocabulary(photo);

    expect(requestOf(generateContent).model).toBe('extraction-model');
    expect(usage).toEqual({ inputTokens: 900, outputTokens: 120 });
  });

  /* A misshapen item is not judged here: the item rules decide, in one place. */
  it('passes a broken item on rather than guessing', async () => {
    const { provider } = gemini(
      answering({ items: [item({ box: [1, 2], english: undefined })] }),
    );

    const { value } = await provider.extractVocabulary(photo);

    expect(value[0].english).toBe('');
    expect(checkedItems(value)).toEqual([]);
  });

  it('refuses an answer with no list of items', async () => {
    const { provider } = gemini(answering({ words: [] }));

    await expect(provider.extractVocabulary(photo)).rejects.toMatchObject({
      code: 'INVALID_OUTPUT',
    });
  });

  /* The photo already passed the safety check, so a refusal here is the provider. */
  it('treats a refusal as a provider error, not a block', async () => {
    const { provider } = gemini(
      answering({}, {
        candidates: [{ finishReason: 'SAFETY' }],
      } as Partial<GenerateContentResponse>),
    );

    await expect(provider.extractVocabulary(photo)).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
    });
  });
});

describe('when the call itself fails', () => {
  it('reports a timeout as a timeout', async () => {
    const aborted = new Error('The operation was aborted');
    aborted.name = 'TimeoutError';
    const { provider } = gemini(aborted);

    await expect(provider.checkPhoto(photo)).rejects.toMatchObject({
      code: 'TIMED_OUT',
    });
  });

  it('reports anything else as a provider error', async () => {
    const { provider } = gemini(new Error('503 Service Unavailable'));

    await expect(provider.extractVocabulary(photo)).rejects.toBeInstanceOf(
      AiProviderError,
    );
    await expect(provider.extractVocabulary(photo)).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
    });
  });

  it('refuses an empty answer', async () => {
    const { provider } = gemini({ text: undefined });

    await expect(provider.checkPhoto(photo)).rejects.toMatchObject({
      code: 'INVALID_OUTPUT',
    });
  });

  it('refuses an answer that is not JSON', async () => {
    const { provider } = gemini({ text: 'I am afraid I cannot do that.' });

    await expect(provider.extractVocabulary(photo)).rejects.toMatchObject({
      code: 'INVALID_OUTPUT',
    });
  });
});

describe('which model answers which question', () => {
  it('uses the model configured for each job', () => {
    const { provider } = gemini(answering({}));

    expect(provider.name).toBe('gemini');
    expect(provider.modelFor('SAFETY_CHECK')).toBe('safety-model');
    expect(provider.modelFor('EXTRACTION')).toBe('extraction-model');
  });
});
