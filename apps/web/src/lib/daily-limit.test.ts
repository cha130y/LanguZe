import { expect, test } from 'vitest';
import { resetsAtText } from './daily-limit';

/** V1: the count starts again at midnight in Bangkok, which is 17:00 UTC. */
test('writes the reset in Bangkok time, not the reader’s', () => {
  expect(resetsAtText('2026-09-25T17:00:00.000Z')).toBe('26 ก.ย. 00:00');
});

test('says nothing when the API sent something that is not a time', () => {
  expect(resetsAtText('soon')).toBe('');
});
