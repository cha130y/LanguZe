import type { AiPurpose, BlockCategory } from '../generated/prisma/enums.js';
import type { AiUsage } from './ai-call-recorder.js';
import type { ExtractedItem } from '../vocabulary/extraction-rules.js';

/** A prepared photo on its way to a provider: at most 2,048 pixels (FR-017, V18). */
export interface PhotoForAi {
  data: Buffer;
  contentType: string;
}

/**
 * What the safety check decided (FR-091, FR-092). A refusal by the provider's own
 * safety filters counts as a block, with `OTHER` when no category fits (ADR-0004).
 */
export type SafetyVerdict =
  { allowed: true } | { allowed: false; category: BlockCategory };

/**
 * An answer and what it cost. The usage travels with the answer so that the caller
 * can record it without asking the provider afterwards, which would be a second
 * question with a racy answer (AIR-007).
 */
export interface AiAnswer<T> {
  value: T;
  usage?: AiUsage;
}

/**
 * Why a provider call could not produce an answer. This is never a block: a failure
 * is LanguZe's or the provider's, so the analysis fails and is not counted (FR-025).
 */
export class AiProviderError extends Error {
  constructor(
    readonly code: 'PROVIDER_ERROR' | 'TIMED_OUT' | 'INVALID_OUTPUT',
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'AiProviderError';
  }
}

/**
 * What LanguZe asks an AI provider to do (AIR-001). Business rules depend on this
 * interface and never on a provider's SDK, so a provider change is a new adapter
 * rather than a rewrite. The abstract class is also the injection token.
 *
 * The two photo jobs are separate calls on purpose: a photo is classified before it
 * is described, so a blocked photo never reaches extraction (FR-092, ADR-0004).
 */
export abstract class AiProvider {
  /** The provider's name, as the call records show it (AIR-007). */
  abstract readonly name: string;

  /** Which model answers one kind of question; they differ per job (ADR-0004). */
  abstract modelFor(purpose: AiPurpose): string;

  /** Whether this photo may be used at all (FR-091, FR-092). */
  abstract checkPhoto(photo: PhotoForAi): Promise<AiAnswer<SafetyVerdict>>;

  /**
   * The objects in the photo, in the provider's own order of confidence. Whatever
   * it returns is untrusted input: the caller checks every item (AIR-003, FR-023).
   */
  abstract extractVocabulary(
    photo: PhotoForAi,
  ): Promise<AiAnswer<ExtractedItem[]>>;
}
