import { describe, expect, it } from 'vitest';
import { selectReviewWords, type ReviewCandidate } from './review-selection.js';

const HOUR = 3_600_000;
const now = Date.parse('2026-09-25T12:00:00.000Z');

const word = (
  name: string,
  overrides: Partial<ReviewCandidate> = {},
): ReviewCandidate => ({
  vocabularyWordId: name,
  occurrenceId: `occurrence-${name}`,
  level: 'LEARNING',
  lastPractisedAt: now - HOUR,
  lastMistakeAt: null,
  ...overrides,
});

const namesOf = (chosen: ReviewCandidate[]) =>
  chosen.map((c) => c.vocabularyWordId);

describe('choosing what to review (FR-050)', () => {
  /* US-050 criterion 1, in the order it states. */
  it('puts mistakes first, then FAMILIAR, then LEARNING', () => {
    const chosen = selectReviewWords(
      [
        word('learning'),
        word('familiar', { level: 'FAMILIAR' }),
        word('missed', { level: 'FAMILIAR', lastMistakeAt: now - HOUR }),
      ],
      10,
    );

    expect(namesOf(chosen)).toEqual(['missed', 'familiar', 'learning']);
  });

  /* A word missed an hour ago is the one about to be forgotten. */
  it('asks about the most recent mistake first', () => {
    const chosen = selectReviewWords(
      [
        word('old', { lastMistakeAt: now - 40 * HOUR }),
        word('fresh', { lastMistakeAt: now - HOUR }),
        word('middling', { lastMistakeAt: now - 10 * HOUR }),
      ],
      10,
    );

    expect(namesOf(chosen)).toEqual(['fresh', 'middling', 'old']);
  });

  /* Among words never got wrong, the ones left alone longest come back first. */
  it('asks about the least recently practised first', () => {
    const chosen = selectReviewWords(
      [
        word('yesterday', {
          level: 'FAMILIAR',
          lastPractisedAt: now - 24 * HOUR,
        }),
        word('just now', { level: 'FAMILIAR', lastPractisedAt: now - HOUR }),
        word('last week', {
          level: 'FAMILIAR',
          lastPractisedAt: now - 168 * HOUR,
        }),
      ],
      10,
    );

    expect(namesOf(chosen)).toEqual(['last week', 'yesterday', 'just now']);
  });

  /*
   * A word with a mistake is in the first group whatever its level, so a FAMILIAR
   * word that was missed comes before a LEARNING word that never was.
   */
  it('lets a mistake outrank the level', () => {
    const chosen = selectReviewWords(
      [
        word('clean learning', { level: 'LEARNING' }),
        word('missed familiar', {
          level: 'FAMILIAR',
          lastMistakeAt: now - HOUR,
        }),
      ],
      10,
    );

    expect(namesOf(chosen)).toEqual(['missed familiar', 'clean learning']);
  });

  it('asks about a word once, however many ways it qualifies', () => {
    const chosen = selectReviewWords(
      [word('one', { level: 'FAMILIAR', lastMistakeAt: now - HOUR })],
      10,
    );

    expect(namesOf(chosen)).toEqual(['one']);
  });

  it('stops at the limit', () => {
    const many = Array.from({ length: 14 }, (_, i) =>
      word(`w${i}`, { lastMistakeAt: now - i * HOUR }),
    );

    expect(selectReviewWords(many, 10)).toHaveLength(10);
  });

  /* US-050: review is for repairing what is half-known (FR-050). */
  it('leaves out a word the learner has mastered', () => {
    const chosen = selectReviewWords(
      [
        word('mastered', { level: 'MASTERED', lastMistakeAt: now - HOUR }),
        word('learning'),
      ],
      10,
    );

    expect(namesOf(chosen)).toEqual(['learning']);
  });

  it('asks nothing when nothing qualifies', () => {
    expect(selectReviewWords([], 10)).toEqual([]);
  });

  /*
   * Unlike a game, a review is not shuffled (FR-030 against FR-050): its order is
   * the point, and moving the neediest words about would bury them.
   */
  it('gives the same order every time', () => {
    const candidates = [
      word('a', { lastMistakeAt: now - 2 * HOUR }),
      word('b', { level: 'FAMILIAR' }),
      word('c'),
    ];

    const orders = new Set(
      Array.from({ length: 5 }, () =>
        namesOf(selectReviewWords(candidates, 10)).join(','),
      ),
    );

    expect(orders.size).toBe(1);
  });
});
