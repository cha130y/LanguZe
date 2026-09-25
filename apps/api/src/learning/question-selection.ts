import type { MasteryLevel } from '../generated/prisma/enums.js';

/** The most questions one session asks (FR-030, FR-050). */
export const QUESTIONS_PER_SESSION = 10;

/** One of a world's words, and how well the learner knows it. */
export interface Candidate {
  occurrenceId: string;
  vocabularyWordId: string;
  /** Empty for a word never answered, which is `NEW` (FR-040). */
  level: MasteryLevel | null;
}

/**
 * Which words come first. `NEW` and `LEARNING` share a place, as FR-030 states
 * them: both are words the learner cannot yet be said to know, and a session that
 * asked every new word before every half-learned one would drill the newest words
 * and leave the nearly-known ones alone.
 */
const ORDER: Record<MasteryLevel, number> = {
  LEARNING: 0,
  FAMILIAR: 1,
  MASTERED: 2,
};

const placeOf = (level: MasteryLevel | null): number =>
  level ? ORDER[level] : 0;

export type Shuffle = <T>(items: readonly T[]) => T[];

/** Fisher–Yates: every order equally likely, which "random order" has to mean. */
const shuffleRandomly: Shuffle = (items) => {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * The questions of one game, in the order they are asked (FR-030): the words the
 * learner knows least first, random within each group, and at most ten.
 *
 * Random order is what keeps a world from becoming a sequence to memorize — after
 * a few games a fixed order teaches the order, not the words. The shuffle is an
 * argument so that a test can say exactly what it did.
 */
export function selectQuestions(
  candidates: readonly Candidate[],
  shuffle: Shuffle = shuffleRandomly,
): Candidate[] {
  const groups = [0, 1, 2].map((place) =>
    shuffle(candidates.filter((word) => placeOf(word.level) === place)),
  );
  return groups.flat().slice(0, QUESTIONS_PER_SESSION);
}
