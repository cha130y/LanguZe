import { describe, expect, it } from 'vitest';
import { dayStart, nextReset } from './daily-limit.js';

/** Bangkok is seven hours ahead, so its midnight is 17:00 UTC the day before. */
describe('the learner’s day (FR-020, FR-080)', () => {
  it.each([
    // Just after midnight in Bangkok, which is still yesterday evening in UTC.
    ['2026-09-24T17:30:00.000Z', '2026-09-24T17:00:00.000Z'],
    // Late morning in Bangkok.
    ['2026-09-25T04:00:00.000Z', '2026-09-24T17:00:00.000Z'],
    // One minute before midnight in Bangkok: the same day still.
    ['2026-09-25T16:59:00.000Z', '2026-09-24T17:00:00.000Z'],
    // Midnight in Bangkok exactly: a new day.
    ['2026-09-25T17:00:00.000Z', '2026-09-25T17:00:00.000Z'],
  ])('%s belongs to the day that began at %s', (now, expected) => {
    expect(dayStart(new Date(now)).toISOString()).toBe(expected);
  });

  it('resets at the next midnight in Bangkok', () => {
    expect(nextReset(new Date('2026-09-25T04:00:00.000Z')).toISOString()).toBe(
      '2026-09-25T17:00:00.000Z',
    );
  });

  /* The limit would be wrong for half of every day if this used UTC midnight. */
  it('is not UTC midnight', () => {
    expect(dayStart(new Date('2026-09-25T04:00:00.000Z')).getUTCHours()).toBe(
      17,
    );
  });
});
