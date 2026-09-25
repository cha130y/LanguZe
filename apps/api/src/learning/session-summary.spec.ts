import { describe, expect, it } from 'vitest';
import { summaryOf, type SummarisedAttempt } from './session-summary.js';

const attempt = (
  overrides: Partial<SummarisedAttempt> = {},
): SummarisedAttempt => ({
  isCorrect: true,
  xpAwarded: 10,
  levelBefore: null,
  levelAfter: 'LEARNING',
  english: 'sofa',
  ...overrides,
});

describe('the end of a session (FR-035, US-033)', () => {
  it('counts the right answers and adds up the XP', () => {
    const summary = summaryOf([
      attempt(),
      attempt({ english: 'lamp' }),
      attempt({ isCorrect: false, xpAwarded: 0, english: 'rug' }),
    ]);

    expect(summary.answeredCount).toBe(3);
    expect(summary.correctCount).toBe(2);
    expect(summary.xpEarned).toBe(20);
  });

  it('names the words that moved, and where they ended', () => {
    const summary = summaryOf([
      // NEW to LEARNING: a move, and worth telling the learner about.
      attempt({ english: 'sofa', levelBefore: null, levelAfter: 'LEARNING' }),
      attempt({
        english: 'lamp',
        levelBefore: 'LEARNING',
        levelAfter: 'FAMILIAR',
      }),
    ]);

    expect(summary.levelChanges).toEqual([
      { english: 'sofa', level: 'LEARNING' },
      { english: 'lamp', level: 'FAMILIAR' },
    ]);
  });

  /* A right answer that changed nothing is not an achievement to announce. */
  it('leaves out words that stayed where they were', () => {
    const summary = summaryOf([
      attempt({
        english: 'sofa',
        levelBefore: 'MASTERED',
        levelAfter: 'MASTERED',
      }),
      attempt({
        english: 'lamp',
        levelBefore: 'FAMILIAR',
        levelAfter: 'FAMILIAR',
      }),
    ]);

    expect(summary.levelChanges).toEqual([]);
    expect(summary.correctCount).toBe(2);
  });

  /* Going down is a change too, and hiding it would flatter the learner. */
  it('names a word that fell back', () => {
    const summary = summaryOf([
      attempt({
        isCorrect: false,
        xpAwarded: 0,
        levelBefore: 'MASTERED',
        levelAfter: 'FAMILIAR',
      }),
    ]);

    expect(summary.levelChanges).toEqual([
      { english: 'sofa', level: 'FAMILIAR' },
    ]);
  });

  /* A session left with nothing answered still has to add up to nothing. */
  it('adds up an empty session', () => {
    expect(summaryOf([])).toEqual({
      answeredCount: 0,
      correctCount: 0,
      xpEarned: 0,
      levelChanges: [],
    });
  });
});
