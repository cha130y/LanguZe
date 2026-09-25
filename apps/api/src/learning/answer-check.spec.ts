import { describe, expect, it } from 'vitest';
import { XP_FOR_CORRECT, isCorrectAnswer, xpFor } from './answer-check.js';

const sofa = (typed: string) =>
  isCorrectAnswer(typed, 'sofa', ['couch', 'sofas']);

describe('checking an answer (FR-032, SRS 4.2)', () => {
  /* US-031 criterion 1, word for word. */
  it.each(['sofa', 'Sofa', 'SOFA', ' a sofa ', 'the sofa', 'couch', 'sofas'])(
    'accepts %o',
    (typed) => {
      expect(sofa(typed)).toBe(true);
    },
  );

  /* A typo is not the word. Accepting one would teach a spelling that is wrong. */
  it.each(['sofaa', 'sof', 'so fa', 'couche', 'settee', ''])(
    'refuses %o',
    (typed) => {
      expect(sofa(typed)).toBe(false);
    },
  );

  it('collapses repeated spaces inside an answer', () => {
    expect(isCorrectAnswer('  coffee   table ', 'coffee table', [])).toBe(true);
  });

  /* Only one article comes off, so "a a sofa" is still not the word. */
  it('removes one leading article, not two', () => {
    expect(sofa('a a sofa')).toBe(false);
  });

  /* An article inside the word is part of it: "the" alone is not a word here. */
  it('does not strip an article that is the whole answer', () => {
    expect(isCorrectAnswer('the', 'the', [])).toBe(true);
  });
});

describe('what an answer earns (FR-060)', () => {
  it('gives 10 XP for a correct answer', () => {
    expect(xpFor(true)).toBe(XP_FOR_CORRECT);
  });

  /* US-031 criterion 3: a wrong answer earns nothing and never takes XP away. */
  it('gives nothing for a wrong one, and never less than nothing', () => {
    expect(xpFor(false)).toBe(0);
  });
});
