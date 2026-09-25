import { normalizeAnswer } from '../vocabulary/extraction-rules.js';

/** The longest answer a learner may type (FR-032, V19). */
export const MAX_ANSWER_LENGTH = 100;

/** What one correct answer is worth, in a game or a review (FR-060). */
export const XP_FOR_CORRECT = 10;

/**
 * Whether what the learner typed names the word (FR-032, SRS 4.2).
 *
 * Both sides go through the same normalization the word itself was stored with —
 * case, outer and repeated spaces, and one leading article — which is why this
 * imports the vocabulary rule rather than keeping a second copy of it. Two
 * spellings of that rule would mean a learner typing exactly the stored word and
 * being told they were wrong.
 *
 * Typos are not accepted. `sofaa` is not `sofa`, and guessing at what someone meant
 * would teach them a spelling LanguZe invented.
 */
export function isCorrectAnswer(
  typed: string,
  word: string,
  acceptedVariants: readonly string[],
): boolean {
  const answer = normalizeAnswer(typed);
  // An empty answer is never right, and the API refuses it before it gets here.
  if (!answer) return false;

  return [word, ...acceptedVariants].some(
    (accepted) => normalizeAnswer(accepted) === answer,
  );
}

/** XP for one attempt. An incorrect answer earns nothing and costs nothing (V4). */
export const xpFor = (correct: boolean): number =>
  correct ? XP_FOR_CORRECT : 0;
