import {
  bangkokDay,
  nextBangkokMidnight,
  startOfBangkokDay,
} from './bangkok-day.js';

describe('Asia/Bangkok days', () => {
  it('changes day at 17:00 UTC, which is midnight in Bangkok', () => {
    expect(bangkokDay(new Date('2026-09-19T16:59:59.999Z'))).toBe('2026-09-19');
    expect(bangkokDay(new Date('2026-09-19T17:00:00.000Z'))).toBe('2026-09-20');
  });

  it('finds the start of the Bangkok day as a UTC instant', () => {
    expect(
      startOfBangkokDay(new Date('2026-09-20T01:30:00Z')).toISOString(),
    ).toBe('2026-09-19T17:00:00.000Z');
  });

  it('treats midnight itself as the start of a new day', () => {
    const midnight = new Date('2026-09-19T17:00:00Z');
    expect(startOfBangkokDay(midnight).toISOString()).toBe(
      midnight.toISOString(),
    );
  });

  it('finds the next reset time for daily limits', () => {
    expect(
      nextBangkokMidnight(new Date('2026-09-19T23:00:00Z')).toISOString(),
    ).toBe('2026-09-20T17:00:00.000Z');
  });

  /*
   * The two cases that catch the mistake anyone rewriting this would make. Using
   * UTC midnight instead would put the daily limit and the mastery day into the
   * wrong day for seven hours out of every twenty-four (V1, FR-080).
   */
  it('is not UTC midnight', () => {
    expect(
      startOfBangkokDay(new Date('2026-09-25T04:00:00.000Z')).getUTCHours(),
    ).toBe(17);
  });

  it('keeps the last minute before midnight in the day that is ending', () => {
    expect(
      startOfBangkokDay(new Date('2026-09-25T16:59:00.000Z')).toISOString(),
    ).toBe('2026-09-24T17:00:00.000Z');
    expect(bangkokDay(new Date('2026-09-25T16:59:00.000Z'))).toBe('2026-09-25');
  });

  it('crosses month and year boundaries', () => {
    expect(bangkokDay(new Date('2026-12-31T17:00:00Z'))).toBe('2027-01-01');
    expect(
      nextBangkokMidnight(new Date('2027-02-28T10:00:00Z')).toISOString(),
    ).toBe('2027-02-28T17:00:00.000Z');
  });
});
