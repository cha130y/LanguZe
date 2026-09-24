import type {
  GenerateContentParameters,
  GenerateContentResponse,
} from '@google/genai';
import type { AiPurpose, BlockCategory } from '../../generated/prisma/enums.js';
import type { ExtractedItem } from '../../vocabulary/extraction-rules.js';
import type { AiUsage } from '../ai-call-recorder.js';
import {
  AiProvider,
  AiProviderError,
  type AiAnswer,
  type PhotoForAi,
  type SafetyVerdict,
} from '../ai-provider.js';
import {
  BLOCK_CATEGORIES,
  EXTRACTION_INSTRUCTION,
  EXTRACTION_SCHEMA,
  SAFETY_INSTRUCTION,
  SAFETY_SCHEMA,
} from './prompts.js';

/** The part of the SDK this adapter uses, so a test can stand in for the network. */
export interface GeminiModels {
  generateContent(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse>;
}

export interface GeminiSettings {
  safetyModel: string;
  extractionModel: string;
  timeoutMs: number;
}

/** Gemini's own words for why it refused, mapped to LanguZe's categories (FR-091). */
const REFUSAL_CATEGORIES: Record<string, BlockCategory> = {
  HARM_CATEGORY_SEXUALLY_EXPLICIT: 'SEXUAL_CONTENT',
  HARM_CATEGORY_CSAM: 'SUSPECTED_ILLEGAL_MATERIAL',
  HARM_CATEGORY_DANGEROUS_CONTENT: 'ILLEGAL_ACTIVITY',
  HARM_CATEGORY_HARASSMENT: 'HATE_SYMBOL',
  HARM_CATEGORY_HATE_SPEECH: 'HATE_SYMBOL',
};

/** Gemini returns boxes as [ymin, xmin, ymax, xmax] from 0 to 1000 (ADR-0004). */
const BOX_SCALE = 1000;

/**
 * Gemini behind LanguZe's AI interface (ADR-0004). This is the only file that knows
 * the SDK: everything else depends on `AiProvider`, so another provider is another
 * adapter rather than a change to the analysis.
 *
 * Nothing about the learner is ever sent — only the prepared photo and fixed
 * instructions (AIR-002, AIR-006).
 */
export class GeminiAiProvider extends AiProvider {
  readonly name = 'gemini';

  constructor(
    private readonly models: GeminiModels,
    private readonly settings: GeminiSettings,
  ) {
    super();
  }

  modelFor(purpose: AiPurpose): string {
    return purpose === 'EXTRACTION'
      ? this.settings.extractionModel
      : this.settings.safetyModel;
  }

  /**
   * Classifies the photo before anything describes it (FR-092). Gemini refusing to
   * answer at all counts as a block, because a photo its own filters will not look
   * at is not one LanguZe should keep (ADR-0004).
   */
  async checkPhoto(photo: PhotoForAi): Promise<AiAnswer<SafetyVerdict>> {
    const response = await this.ask({
      model: this.settings.safetyModel,
      contents: [{ role: 'user', parts: [imagePart(photo)] }],
      config: {
        systemInstruction: SAFETY_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: SAFETY_SCHEMA,
        abortSignal: AbortSignal.timeout(this.settings.timeoutMs),
      },
    });

    const refusal = refusalCategory(response);
    if (refusal) {
      return {
        value: { allowed: false, category: refusal },
        usage: usageOf(response),
      };
    }

    const answer = parse<{ allowed?: unknown; category?: unknown }>(response);
    if (typeof answer.allowed !== 'boolean') {
      throw new AiProviderError(
        'INVALID_OUTPUT',
        'The safety check gave no verdict.',
      );
    }

    return {
      value: answer.allowed
        ? { allowed: true }
        : { allowed: false, category: categoryOf(answer.category) },
      usage: usageOf(response),
    };
  }

  /**
   * The objects in the photo. Whatever comes back is untrusted: the boxes are put
   * into LanguZe's own shape here, and the `vocabulary` rules decide what may be
   * saved (AIR-003, FR-023).
   */
  async extractVocabulary(
    photo: PhotoForAi,
  ): Promise<AiAnswer<ExtractedItem[]>> {
    const response = await this.ask({
      model: this.settings.extractionModel,
      contents: [{ role: 'user', parts: [imagePart(photo)] }],
      config: {
        systemInstruction: EXTRACTION_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: EXTRACTION_SCHEMA,
        abortSignal: AbortSignal.timeout(this.settings.timeoutMs),
      },
    });

    // A refusal here is not a block: the photo already passed the safety check, so
    // this is the provider failing, and the analysis is released (FR-025).
    if (refusalCategory(response)) {
      throw new AiProviderError(
        'PROVIDER_ERROR',
        'Gemini refused to describe the photo.',
      );
    }

    const answer = parse<{ items?: unknown }>(response);
    if (!Array.isArray(answer.items)) {
      throw new AiProviderError(
        'INVALID_OUTPUT',
        'The extraction returned no list of items.',
      );
    }

    return {
      value: answer.items.map(asExtractedItem),
      usage: usageOf(response),
    };
  }

  /** One call, with every way it can fail turned into one of LanguZe's own. */
  private async ask(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse> {
    try {
      return await this.models.generateContent(request);
    } catch (error) {
      if (isTimeout(error)) {
        throw new AiProviderError(
          'TIMED_OUT',
          'Gemini did not answer in time',
          {
            cause: error,
          },
        );
      }
      throw new AiProviderError('PROVIDER_ERROR', 'Gemini could not answer', {
        cause: error,
      });
    }
  }
}

const imagePart = (photo: PhotoForAi) => ({
  inlineData: {
    mimeType: photo.contentType,
    data: photo.data.toString('base64'),
  },
});

/** Structured output still arrives as text, so it still has to be parsed. */
function parse<T>(response: GenerateContentResponse): T {
  const text = response.text;
  if (!text) {
    throw new AiProviderError(
      'INVALID_OUTPUT',
      'Gemini answered with nothing.',
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new AiProviderError(
      'INVALID_OUTPUT',
      'Gemini answered with something that is not JSON.',
      { cause: error },
    );
  }
}

/** Whether Gemini's own filters stopped the request or the answer. */
function refusalCategory(
  response: GenerateContentResponse,
): BlockCategory | null {
  const promptReason = response.promptFeedback?.blockReason;
  const ratings = response.promptFeedback?.safetyRatings ?? [];
  const finish = response.candidates?.[0]?.finishReason;

  // `finishReason` is an enum in the SDK and a string on the wire; compare as text.
  if (!promptReason && String(finish) !== 'SAFETY') return null;

  const category = ratings.find((rating) => rating.blocked)?.category;
  return (category && REFUSAL_CATEGORIES[category]) ?? 'OTHER';
}

/** A category LanguZe knows, or `OTHER` for anything else the model invents. */
const categoryOf = (value: unknown): BlockCategory =>
  typeof value === 'string' && BLOCK_CATEGORIES.includes(value)
    ? (value as BlockCategory)
    : 'OTHER';

function usageOf(response: GenerateContentResponse): AiUsage {
  return {
    inputTokens: response.usageMetadata?.promptTokenCount,
    outputTokens: response.usageMetadata?.candidatesTokenCount,
  };
}

const isTimeout = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === 'AbortError' ||
    error.name === 'TimeoutError' ||
    error.message.toLowerCase().includes('abort'));

/**
 * A field that should be text. Anything else becomes empty rather than the words
 * "[object Object]", which would otherwise be offered to a learner as vocabulary.
 */
const text = (value: unknown): string =>
  typeof value === 'string' ? value : '';

/**
 * One item as LanguZe describes it. Anything missing or misshapen is left as it is
 * and refused later by the item rules, which is the one place that decides
 * (AIR-003): this function only changes the shape, never the judgement.
 */
function asExtractedItem(raw: unknown): ExtractedItem {
  const item = (raw ?? {}) as Record<string, unknown>;
  const box = Array.isArray(item.box) ? item.box.map(Number) : [];
  const [
    ymin = Number.NaN,
    xmin = Number.NaN,
    ymax = Number.NaN,
    xmax = Number.NaN,
  ] = box;

  return {
    english: text(item.english),
    thaiMeaning: text(item.thaiMeaning),
    exampleSentence: text(item.exampleSentence),
    cefrLevel: text(item.cefrLevel),
    acceptedVariants: Array.isArray(item.acceptedVariants)
      ? item.acceptedVariants.filter(
          (variant): variant is string => typeof variant === 'string',
        )
      : [],
    box: {
      x: xmin / BOX_SCALE,
      y: ymin / BOX_SCALE,
      width: (xmax - xmin) / BOX_SCALE,
      height: (ymax - ymin) / BOX_SCALE,
    },
  };
}
