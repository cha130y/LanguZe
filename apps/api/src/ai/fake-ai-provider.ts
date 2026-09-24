import { Injectable } from '@nestjs/common';
import type { ExtractedItem } from '../vocabulary/extraction-rules.js';
import {
  AiProvider,
  AiProviderError,
  type PhotoForAi,
  type SafetyVerdict,
} from './ai-provider.js';

/**
 * What the fake provider does next, which a test sets and a developer can choose
 * with `AI_FAKE_BEHAVIOUR` to see each path in the browser.
 */
export type FakeBehaviour =
  | 'ALLOWED'
  | 'BLOCKED'
  | 'PROVIDER_ERROR'
  | 'TIMED_OUT'
  | 'TOO_FEW_WORDS'
  | 'INVALID_OUTPUT';

/**
 * A photo of a living room, as a provider would describe it: ordered by confidence,
 * with boxes that do not overlap much and sentences an A1–B1 learner can read.
 */
const LIVING_ROOM: ExtractedItem[] = [
  {
    english: 'sofa',
    thaiMeaning: 'โซฟา',
    exampleSentence: 'We sit on the sofa every evening.',
    cefrLevel: 'A1',
    acceptedVariants: ['couch'],
    box: { x: 0.05, y: 0.45, width: 0.4, height: 0.35 },
  },
  {
    english: 'curtain',
    thaiMeaning: 'ผ้าม่าน',
    exampleSentence: 'Please open the curtain in the morning.',
    cefrLevel: 'A2',
    acceptedVariants: ['curtains', 'drape'],
    box: { x: 0.55, y: 0.05, width: 0.3, height: 0.6 },
  },
  {
    english: 'coffee table',
    thaiMeaning: 'โต๊ะกลาง',
    exampleSentence: 'My book is on the coffee table.',
    cefrLevel: 'A2',
    acceptedVariants: ['table'],
    box: { x: 0.2, y: 0.7, width: 0.25, height: 0.18 },
  },
  {
    english: 'rug',
    thaiMeaning: 'พรม',
    exampleSentence: 'The rug under the table is soft.',
    cefrLevel: 'B1',
    acceptedVariants: ['carpet'],
    box: { x: 0.12, y: 0.78, width: 0.5, height: 0.18 },
  },
  {
    english: 'plant',
    thaiMeaning: 'ต้นไม้ในกระถาง',
    exampleSentence: 'I water the plant on Sunday.',
    cefrLevel: 'A1',
    acceptedVariants: ['houseplant'],
    box: { x: 0.72, y: 0.55, width: 0.18, height: 0.3 },
  },
  {
    english: 'clock',
    thaiMeaning: 'นาฬิกาแขวน',
    exampleSentence: 'The clock on the wall is slow.',
    cefrLevel: 'A1',
    acceptedVariants: [],
    box: { x: 0.78, y: 0.08, width: 0.12, height: 0.12 },
  },
];

/** Two items, so the analysis fails the "at least three words" rule (FR-024). */
const ALMOST_NOTHING = LIVING_ROOM.slice(0, 2);

/**
 * Output that looks like a provider having a bad day: an empty word, a meaning with
 * no Thai in it, a box outside the photo, and a sentence that never uses the word.
 * Every item is refused, so the analysis fails as invalid output (FR-023, AIR-003).
 */
const NONSENSE: ExtractedItem[] = [
  {
    english: '',
    thaiMeaning: 'โซฟา',
    exampleSentence: 'We sit here.',
    cefrLevel: 'A1',
    acceptedVariants: [],
    box: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
  },
  {
    english: 'lamp',
    thaiMeaning: 'lamp',
    exampleSentence: 'The lamp is bright.',
    cefrLevel: 'A1',
    acceptedVariants: [],
    box: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
  },
  {
    english: 'window',
    thaiMeaning: 'หน้าต่าง',
    exampleSentence: 'The room is bright.',
    cefrLevel: 'Z9',
    acceptedVariants: [],
    box: { x: 0.9, y: 0.9, width: 0.5, height: 0.5 },
  },
];

/**
 * The AI provider used in development and in tests (B4). It answers at once, costs
 * nothing, and can be told to take any path the real one might: a blocked photo, a
 * provider error, a timeout, too few words, or output that fails every rule.
 *
 * Fixed answers also make the rest of the pipeline testable: the same photo always
 * gives the same words, so a test can assert what a learner ends up with.
 */
@Injectable()
export class FakeAiProvider extends AiProvider {
  /** What every call does unless a test asks for something else. */
  behaviour: FakeBehaviour = 'ALLOWED';

  /** Used once, then forgotten: for a test that needs one call to differ. */
  private next: FakeBehaviour | null = null;

  /**
   * What this provider was asked, in order, with the size of each photo — enough
   * for a test to check that the prepared photo was sent rather than the upload.
   */
  readonly calls: {
    purpose: 'SAFETY_CHECK' | 'EXTRACTION';
    bytes: number;
  }[] = [];

  behaveOnce(behaviour: FakeBehaviour): void {
    this.next = behaviour;
  }

  /*
   * A failure comes back as a rejected promise rather than a thrown error, exactly
   * as a real provider's would: a caller may reasonably use `.catch` instead of
   * try/catch, and a fake that threw first would let that mistake through.
   */
  checkPhoto(photo: PhotoForAi): Promise<SafetyVerdict> {
    this.calls.push({ purpose: 'SAFETY_CHECK', bytes: photo.data.byteLength });
    const behaviour = this.take();
    const failure = this.failureFor(behaviour);
    if (failure) return Promise.reject(failure);

    return Promise.resolve(
      behaviour === 'BLOCKED'
        ? { allowed: false, category: 'VIOLENCE' }
        : { allowed: true },
    );
  }

  extractVocabulary(photo: PhotoForAi): Promise<ExtractedItem[]> {
    this.calls.push({ purpose: 'EXTRACTION', bytes: photo.data.byteLength });
    const behaviour = this.take();
    const failure = this.failureFor(behaviour);
    if (failure) return Promise.reject(failure);

    if (behaviour === 'TOO_FEW_WORDS') return Promise.resolve(ALMOST_NOTHING);
    if (behaviour === 'INVALID_OUTPUT') return Promise.resolve(NONSENSE);
    return Promise.resolve(LIVING_ROOM);
  }

  /**
   * The behaviour a call uses. A one-off set with `behaveOnce` is consumed here, so
   * the next call falls back to the standing behaviour — which is how a test makes
   * only the safety check fail, or only the extraction.
   */
  private take(): FakeBehaviour {
    const behaviour = this.next ?? this.behaviour;
    this.next = null;
    return behaviour;
  }

  private failureFor(behaviour: FakeBehaviour): AiProviderError | null {
    if (behaviour === 'PROVIDER_ERROR') {
      return new AiProviderError(
        'PROVIDER_ERROR',
        'The fake provider refused.',
      );
    }
    if (behaviour === 'TIMED_OUT') {
      return new AiProviderError('TIMED_OUT', 'The fake provider timed out.');
    }
    return null;
  }
}
