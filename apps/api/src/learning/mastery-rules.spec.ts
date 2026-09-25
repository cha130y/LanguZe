import { describe, expect, it } from 'vitest';
import { nextMastery, type Mastery } from './mastery-rules.js';

const TODAY = '2026-09-25';
const YESTERDAY = '2026-09-24';

const learning = (streak: number): Mastery => ({
  level: 'LEARNING',
  streak,
  familiarOn: null,
});
const familiar = (on: string, streak = 0): Mastery => ({
  level: 'FAMILIAR',
  streak,
  familiarOn: on,
});
const mastered = (on: string): Mastery => ({
  level: 'MASTERED',
  streak: 0,
  familiarOn: on,
});

const right = (current: Mastery | null, today = TODAY) =>
  nextMastery(current, true, today);
const wrong = (current: Mastery | null, today = TODAY) =>
  nextMastery(current, false, today);

/** SRS 4.1, row by row. US-040 lists the same cases as a learner meets them. */
describe('a NEW word', () => {
  it('starts LEARNING with a streak when the first answer is right', () => {
    expect(right(null)).toEqual({
      level: 'LEARNING',
      streak: 1,
      familiarOn: null,
    });
  });

  it('starts LEARNING with nothing when the first answer is wrong', () => {
    expect(wrong(null)).toEqual({
      level: 'LEARNING',
      streak: 0,
      familiarOn: null,
    });
  });
});

describe('a LEARNING word', () => {
  it('builds a streak', () => {
    expect(right(learning(0))).toEqual(learning(1));
  });

  it('becomes FAMILIAR on the second right answer, and today is its day', () => {
    expect(right(learning(1))).toEqual({
      level: 'FAMILIAR',
      streak: 0,
      familiarOn: TODAY,
    });
  });

  it('loses the streak on a wrong answer, but not the level', () => {
    expect(wrong(learning(1))).toEqual(learning(0));
  });
});

describe('a FAMILIAR word', () => {
  /*
   * US-040 criterion 4. The word became familiar today because the learner got it
   * right today; getting it right again an hour later says nothing about tomorrow.
   */
  it('does not move on its own familiar day', () => {
    expect(right(familiar(TODAY))).toEqual(familiar(TODAY));
  });

  it('builds a streak on a later day', () => {
    expect(right(familiar(YESTERDAY))).toEqual(familiar(YESTERDAY, 1));
  });

  it('becomes MASTERED on the second right answer after its day', () => {
    expect(right(familiar(YESTERDAY, 1))).toEqual({
      level: 'MASTERED',
      streak: 0,
      familiarOn: YESTERDAY,
    });
  });

  /* Two right answers on the familiar day itself must never reach MASTERED. */
  it('cannot be mastered twice over in one day', () => {
    const once = right(familiar(TODAY));
    expect(right(once).level).toBe('FAMILIAR');
  });

  it('falls back to LEARNING on a wrong answer', () => {
    expect(wrong(familiar(YESTERDAY, 1))).toEqual({
      level: 'LEARNING',
      streak: 0,
      familiarOn: YESTERDAY,
    });
  });
});

describe('a MASTERED word', () => {
  it('stays as it is while the answers are right', () => {
    expect(right(mastered(YESTERDAY))).toEqual(mastered(YESTERDAY));
  });

  /* One level down, not all the way: forgetting a word once is not starting over. */
  it('falls back to FAMILIAR on a wrong answer, with today as its day', () => {
    expect(wrong(mastered(YESTERDAY))).toEqual({
      level: 'FAMILIAR',
      streak: 0,
      familiarOn: TODAY,
    });
  });
});

describe('the whole way up (US-040)', () => {
  it('takes four right answers across two days', () => {
    // Day one: NEW to FAMILIAR.
    const first = right(null, YESTERDAY);
    expect(first.level).toBe('LEARNING');
    const second = right(first, YESTERDAY);
    expect(second).toEqual({
      level: 'FAMILIAR',
      streak: 0,
      familiarOn: YESTERDAY,
    });

    // The same day again changes nothing.
    expect(right(second, YESTERDAY)).toEqual(second);

    // Day two: two more right answers reach MASTERED.
    const third = right(second, TODAY);
    expect(third.level).toBe('FAMILIAR');
    expect(right(third, TODAY).level).toBe('MASTERED');
  });

  /* The rule never leaves a word in a state the database cannot hold. */
  it('never produces a negative streak', () => {
    const states = [
      null,
      learning(0),
      learning(1),
      familiar(TODAY),
      mastered(TODAY),
    ];
    for (const state of states) {
      expect(nextMastery(state, true, TODAY).streak).toBeGreaterThanOrEqual(0);
      expect(nextMastery(state, false, TODAY).streak).toBeGreaterThanOrEqual(0);
    }
  });
});
