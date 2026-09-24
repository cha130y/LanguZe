/**
 * The daily analysis limit resets at midnight in Bangkok, because that is when a
 * learner's day starts (FR-020, FR-080). Thailand keeps one offset all year and has
 * no daylight saving, so the arithmetic is a fixed seven hours rather than a time
 * zone library.
 */
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The moment the learner's current day began, as an instant in UTC. */
export function dayStart(now: Date): Date {
  const local = now.getTime() + BANGKOK_OFFSET_MS;
  return new Date(local - (local % DAY_MS) - BANGKOK_OFFSET_MS);
}

/** When the limit resets: the next midnight in Bangkok. */
export const nextReset = (now: Date): Date =>
  new Date(dayStart(now).getTime() + DAY_MS);
