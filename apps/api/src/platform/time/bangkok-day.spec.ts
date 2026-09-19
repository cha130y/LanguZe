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

  it('crosses month and year boundaries', () => {
    expect(bangkokDay(new Date('2026-12-31T17:00:00Z'))).toBe('2027-01-01');
    expect(
      nextBangkokMidnight(new Date('2027-02-28T10:00:00Z')).toISOString(),
    ).toBe('2027-02-28T17:00:00.000Z');
  });
});
