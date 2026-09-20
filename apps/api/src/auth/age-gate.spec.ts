import {
  AGE_BLOCK_COOKIE,
  earliestAllowedBirthYear,
  hasAgeBlockCookie,
  isOldEnough,
} from './age-gate.js';

describe('age gate', () => {
  const duringYear = new Date('2026-03-01T00:00:00Z');

  it('allows someone who turns 18 later this year', () => {
    expect(earliestAllowedBirthYear(duringYear)).toBe(2008);
    expect(isOldEnough(2008, duringYear)).toBe(true);
  });

  it('refuses someone who turns 17 this year', () => {
    expect(isOldEnough(2009, duringYear)).toBe(false);
  });

  it('allows older learners', () => {
    expect(isOldEnough(1975, duringYear)).toBe(true);
  });

  it('moves with the calendar year', () => {
    expect(isOldEnough(2009, new Date('2027-01-01T00:00:00Z'))).toBe(true);
  });

  describe('block cookie', () => {
    it.each([
      ['the cookie alone', `${AGE_BLOCK_COOKIE}=1`],
      ['the cookie among others', `other=a; ${AGE_BLOCK_COOKIE}=1; more=b`],
    ])('recognizes %s', (_label, header) => {
      expect(hasAgeBlockCookie(header)).toBe(true);
    });

    it.each([
      ['no header', undefined],
      ['other cookies only', 'other=a; more=b'],
      ['a similar name', `${AGE_BLOCK_COOKIE}_other=1`],
    ])('does not recognize %s', (_label, header) => {
      expect(hasAgeBlockCookie(header)).toBe(false);
    });
  });
});
