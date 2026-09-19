/**
 * Calendar days in Asia/Bangkok (SRS V1), used for daily limits and mastery rules.
 * Asia/Bangkok has used UTC+7 without daylight saving time since 1920, so midnight is a fixed offset.
 */
const BANGKOK_UTC_OFFSET = '+07:00';
const DAY_MS = 24 * 60 * 60 * 1000;

// The en-CA locale formats dates as YYYY-MM-DD.
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The Asia/Bangkok calendar day of an instant, as `YYYY-MM-DD`. */
export function bangkokDay(instant: Date = new Date()): string {
  return dayFormatter.format(instant);
}

/** The instant when the Asia/Bangkok day containing `instant` began. */
export function startOfBangkokDay(instant: Date = new Date()): Date {
  return new Date(`${bangkokDay(instant)}T00:00:00${BANGKOK_UTC_OFFSET}`);
}

/** The next Asia/Bangkok midnight after `instant`, when daily limits reset (FR-080). */
export function nextBangkokMidnight(instant: Date = new Date()): Date {
  return new Date(startOfBangkokDay(instant).getTime() + DAY_MS);
}
