import type { MasteryLevel } from '../generated/prisma/enums.js';

/** One word a review could ask about, with what decides its place in the queue. */
export interface ReviewCandidate {
  vocabularyWordId: string;
  /** From the learner's most recently created world that has the word (FR-051). */
  occurrenceId: string;
  level: MasteryLevel;
  /** When the word was last answered, right or wrong. */
  lastPractisedAt: number;
  /** When it was last got wrong, or empty if it never was. */
  lastMistakeAt: number | null;
}

/**
 * Which words a review asks about, in the order it asks them (FR-050).
 *
 * Three groups, in this order:
 *
 * 1. words the learner has got wrong, most recent mistake first — a word missed an
 *    hour ago is the one they are about to forget;
 * 2. then `FAMILIAR` words, least recently practised first;
 * 3. then `LEARNING` words, same.
 *
 * Nothing is random here, unlike a game (FR-030). A review is meant to bring back
 * a particular set of words, and shuffling would only bury the ones the learner
 * most needs — the order *is* the feature.
 *
 * `MASTERED` words and words never answered are not candidates: review is for
 * repairing what is half-known, and a word with no attempt has nothing to repair.
 */
export function selectReviewWords(
  all: readonly ReviewCandidate[],
  limit: number,
): ReviewCandidate[] {
  /*
   * A mastered word has nothing to repair. The query that feeds this asks only for
   * the other levels, but the rule says so too: which words qualify is as much a
   * part of FR-050 as the order they come in, and a rule split between a query and
   * a function is a rule nobody can read.
   */
  const candidates = all.filter((word) => word.level !== 'MASTERED');

  const mistaken = candidates
    .filter((word) => word.lastMistakeAt !== null)
    .sort((a, b) => (b.lastMistakeAt ?? 0) - (a.lastMistakeAt ?? 0));

  const byLevel = (level: MasteryLevel) =>
    candidates
      .filter((word) => word.lastMistakeAt === null && word.level === level)
      .sort((a, b) => a.lastPractisedAt - b.lastPractisedAt);

  return [...mistaken, ...byLevel('FAMILIAR'), ...byLevel('LEARNING')].slice(
    0,
    limit,
  );
}
