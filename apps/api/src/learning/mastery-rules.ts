import type { MasteryLevel } from '../generated/prisma/enums.js';

/**
 * What LanguZe knows about one word before an attempt (SRS 4.1). `null` is `NEW`:
 * a word nobody has answered has no row at all, so photo analysis never writes
 * learning data (FR-040).
 */
export interface Mastery {
  level: MasteryLevel;
  /** Correct answers in a row at this level. */
  streak: number;
  /** The Asia/Bangkok day the word last became `FAMILIAR`, as `YYYY-MM-DD`. */
  familiarOn: string | null;
}

/** Correct answers in a row needed to move up a level (SRS 4.1). */
const STREAK_TO_ADVANCE = 2;

/**
 * The word's mastery after one attempt (FR-041, SRS 4.1). A pure function of what
 * was known, whether the answer was right, and today's date in Bangkok — it reads
 * nothing and writes nothing, so the whole rule can be read in one place and every
 * case of it tested without a database.
 *
 * `today` is a Bangkok calendar day (V1), because the rule that a `FAMILIAR` word
 * cannot be mastered twice in one day is about the learner's day, not about UTC.
 */
export function nextMastery(
  current: Mastery | null,
  correct: boolean,
  today: string,
): Mastery {
  // NEW: the first attempt starts the word off, right or wrong (SRS 4.1).
  if (!current) {
    return {
      level: 'LEARNING',
      streak: correct ? 1 : 0,
      familiarOn: null,
    };
  }

  if (!correct) return afterMistake(current, today);

  switch (current.level) {
    case 'LEARNING':
      return advanceOr('FAMILIAR', current, today);

    /*
     * A word becomes FAMILIAR on a day the learner got it right. Answering it right
     * again the same day says nothing new about whether they will remember it
     * tomorrow, so only later days count toward MASTERED (SRS 4.1, US-040 #4).
     */
    case 'FAMILIAR':
      return current.familiarOn === today
        ? current
        : advanceOr('MASTERED', current, today);

    // A mastered word stays mastered while the answers keep coming.
    case 'MASTERED':
      return current;
  }
}

/**
 * One more correct answer, and the next level once the streak is long enough.
 *
 * The streak resets on the way up. SRS 4.1 says so for `LEARNING` to `FAMILIAR` and
 * is silent for `FAMILIAR` to `MASTERED`; the two are the same in effect, because a
 * `MASTERED` word never reads its streak and gets a fresh one if it ever falls back.
 */
function advanceOr(
  next: MasteryLevel,
  current: Mastery,
  today: string,
): Mastery {
  const streak = current.streak + 1;
  if (streak < STREAK_TO_ADVANCE) return { ...current, streak };

  return {
    level: next,
    streak: 0,
    // The familiar day moves only when the word arrives at FAMILIAR.
    familiarOn: next === 'FAMILIAR' ? today : current.familiarOn,
  };
}

/**
 * A wrong answer never drops a word more than one level, and never past `LEARNING`:
 * forgetting one word once is not a reason to start it again from nothing.
 */
function afterMistake(current: Mastery, today: string): Mastery {
  if (current.level === 'MASTERED') {
    return { level: 'FAMILIAR', streak: 0, familiarOn: today };
  }
  return { level: 'LEARNING', streak: 0, familiarOn: current.familiarOn };
}
