import type { MasteryLevel } from '../generated/prisma/enums.js';
import type { SessionSummaryDto } from './dto/sessions.dto.js';

/** One answer, as the summary needs to see it. */
export interface SummarisedAttempt {
  isCorrect: boolean;
  xpAwarded: number;
  levelBefore: MasteryLevel | null;
  levelAfter: MasteryLevel;
  english: string;
}

/**
 * What a learner achieved in a session (FR-035, US-033).
 *
 * The level a word stood at before each answer is read from the attempt rather
 * than worked out here, because it cannot be worked out afterwards: mastery keeps
 * only where a word stands now, and by the end of a session that is where it ended,
 * not where it began.
 *
 * A word is listed once, at the level it reached. A session asks each word at most
 * once, so there is nothing to merge; if that ever changes, the last answer is the
 * one that says where the word ended up.
 */
export function summaryOf(
  attempts: readonly SummarisedAttempt[],
): SessionSummaryDto {
  const levelChanges = attempts
    .filter((attempt) => attempt.levelBefore !== attempt.levelAfter)
    .map((attempt) => ({
      english: attempt.english,
      level: attempt.levelAfter,
    }));

  return {
    answeredCount: attempts.length,
    correctCount: attempts.filter((attempt) => attempt.isCorrect).length,
    xpEarned: attempts.reduce((total, attempt) => total + attempt.xpAwarded, 0),
    levelChanges,
  };
}
