import { describe, expect, test } from 'vitest';
import {
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from './auth-schemas';

const validSignUp = {
  email: 'nok@example.com',
  password: 'correct horse battery',
  name: 'Nok',
  birthYear: '1998',
  acceptTerms: true,
};

describe('sign-up rules', () => {
  test('accepts a complete form and reads the year as a number', () => {
    const result = signUpSchema.safeParse(validSignUp);

    expect(result.success).toBe(true);
    expect(result.data?.birthYear).toBe(1998);
  });

  test.each([
    ['an address that is not an email', { email: 'not-an-email' }],
    ['a password under 8 characters', { password: 'short' }],
    ['an empty display name', { name: '   ' }],
    ['a display name over 50 characters', { name: 'ก'.repeat(51) }],
    [
      'a year of birth in the future',
      { birthYear: String(new Date().getFullYear() + 1) },
    ],
    ['a year of birth that is not a number', { birthYear: 'เมื่อวาน' }],
    ['the Terms not accepted', { acceptTerms: false }],
  ])('refuses %s', (_label, change) => {
    expect(signUpSchema.safeParse({ ...validSignUp, ...change }).success).toBe(
      false,
    );
  });

  test('explains problems in Thai', () => {
    const result = signUpSchema.safeParse({
      ...validSignUp,
      password: 'short',
    });

    expect(result.error?.issues[0].message).toMatch(/รหัสผ่าน/);
  });
});

describe('sign-in rules', () => {
  test('needs both an email and a password', () => {
    expect(
      signInSchema.safeParse({ email: 'nok@example.com', password: 'x' })
        .success,
    ).toBe(true);
    expect(
      signInSchema.safeParse({ email: 'nok@example.com', password: '' })
        .success,
    ).toBe(false);
  });
});

describe('reset rules', () => {
  test('needs the two passwords to match', () => {
    const same = {
      newPassword: 'a new password',
      confirmPassword: 'a new password',
    };
    expect(resetPasswordSchema.safeParse(same).success).toBe(true);

    const different = {
      newPassword: 'a new password',
      confirmPassword: 'another one',
    };
    const result = resetPasswordSchema.safeParse(different);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(['confirmPassword']);
  });
});
