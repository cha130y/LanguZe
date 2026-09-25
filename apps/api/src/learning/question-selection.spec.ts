import { describe, expect, it } from 'vitest';
import type { MasteryLevel } from '../generated/prisma/enums.js';
import {
  QUESTIONS_PER_SESSION,
  selectQuestions,
  type Candidate,
  type Shuffle,
} from './question-selection.js';

const word = (occurrenceId: string, level: MasteryLevel | null): Candidate => ({
  occurrenceId,
  vocabularyWordId: `word-${occurrenceId}`,
  level,
});

/** A shuffle that does nothing, so the grouping can be read on its own. */
const inOrder: Shuffle = (items) => [...items];
/** And one that always reverses, so a test can tell shuffling happened. */
const reversed: Shuffle = (items) => [...items].reverse();

const namesOf = (chosen: Candidate[]) => chosen.map((c) => c.occurrenceId);

describe('choosing a game’s questions (FR-030)', () => {
  it('asks the least known words first', () => {
    const chosen = selectQuestions(
      [
        word('mastered', 'MASTERED'),
        word('familiar', 'FAMILIAR'),
        word('learning', 'LEARNING'),
        word('new', null),
      ],
      inOrder,
    );

    expect(namesOf(chosen)).toEqual([
      'learning',
      'new',
      'familiar',
      'mastered',
    ]);
  });

  /* FR-030 groups them, and so does the learner's sense of what they don't know. */
  it('treats a NEW word and a LEARNING word as equally unknown', () => {
    const chosen = selectQuestions(
      [
        word('new', null),
        word('familiar', 'FAMILIAR'),
        word('learning', 'LEARNING'),
      ],
      reversed,
    );

    // Reversing within the first group proves the two share it.
    expect(namesOf(chosen)).toEqual(['learning', 'new', 'familiar']);
  });

  it('asks at most ten', () => {
    const many = Array.from({ length: 12 }, (_, i) => word(`w${i}`, null));

    expect(selectQuestions(many, inOrder)).toHaveLength(QUESTIONS_PER_SESSION);
  });

  it('asks all of a small world', () => {
    const three = [word('a', null), word('b', null), word('c', null)];

    expect(namesOf(selectQuestions(three, inOrder))).toEqual(['a', 'b', 'c']);
  });

  it('asks nothing when there is nothing', () => {
    expect(selectQuestions([], inOrder)).toEqual([]);
  });

  /*
   * A world played twice in a row must not ask the same order, or the game teaches
   * the order rather than the words.
   */
  it('really shuffles, and loses nobody doing it', () => {
    const ten = Array.from({ length: 10 }, (_, i) => word(`w${i}`, null));

    const orders = new Set(
      Array.from({ length: 20 }, () => namesOf(selectQuestions(ten)).join(',')),
    );

    expect(orders.size).toBeGreaterThan(1);
    for (const order of orders) {
      expect(order.split(',').sort()).toEqual(namesOf(ten).sort());
    }
  });
});
