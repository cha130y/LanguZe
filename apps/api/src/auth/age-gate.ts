/**
 * LanguZe is for adults (PRD Q9, SRS V20). Sign-up asks for the year of birth, and a
 * visitor who does not turn 18 during the current year cannot create an account.
 * After a refusal, a short-lived cookie stops the same browser from trying another year.
 */
export const MINIMUM_AGE = 18;
export const AGE_BLOCK_COOKIE = 'languze_age_block';
export const AGE_BLOCK_DURATION_MS = 24 * 60 * 60 * 1000;

/** The earliest year of birth still allowed, counting the whole current year. */
export function earliestAllowedBirthYear(now: Date = new Date()): number {
  return now.getFullYear() - MINIMUM_AGE;
}

export function isOldEnough(
  birthYear: number,
  now: Date = new Date(),
): boolean {
  return birthYear <= earliestAllowedBirthYear(now);
}

/** Reads the block cookie without a cookie parser, from the raw `Cookie` header. */
export function hasAgeBlockCookie(cookieHeader: string | undefined): boolean {
  if (!cookieHeader) return false;
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .some((part) => part.startsWith(`${AGE_BLOCK_COOKIE}=`));
}
