import { expect, test } from 'vitest';
import { ApiError } from './client';
import { messageForCode, messageForError } from './error-messages';

test('gives Thai text for the codes learners can meet', () => {
  expect(
    messageForError(new ApiError('INVALID_CREDENTIALS', 401, 'nope')),
  ).toBe('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  expect(
    messageForError(new ApiError('AGE_BELOW_MINIMUM', 403, 'nope')),
  ).toMatch(/18 ปี/);
  expect(
    messageForError(new ApiError('EMAIL_ALREADY_REGISTERED', 409, 'nope')),
  ).toMatch(/มีบัญชีอยู่แล้ว/);
});

test('never shows the English message from the API', () => {
  const message = messageForError(
    new ApiError(
      'INVALID_CREDENTIALS',
      401,
      'The email address or password is incorrect.',
    ),
  );

  expect(message).not.toMatch(/[a-z]{4}/);
});

test('falls back for an unknown code or a plain error', () => {
  const fallback = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';

  expect(messageForCode('SOMETHING_NEW')).toBe(fallback);
  expect(messageForError(new Error('boom'))).toBe(fallback);
  expect(messageForError('not an error at all')).toBe(fallback);
});
