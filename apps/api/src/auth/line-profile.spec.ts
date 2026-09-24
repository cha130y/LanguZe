import { describe, expect, it } from 'vitest';
import { lineProfileToUser } from './line-profile.js';

describe('LINE profiles (FR-009, D1)', () => {
  it('stores a placeholder address, never LINE’s own', () => {
    const user = lineProfileToUser({
      sub: 'U4af4980629',
      name: 'นก',
      email: 'nok@example.com',
    });

    expect(user.email).toBe('line.u4af4980629@no-email.languze.invalid');
    expect(user.emailVerified).toBe(false);
  });

  it('works when LINE shares no email at all (US-005)', () => {
    const user = lineProfileToUser({ sub: 'U1', name: 'นก' });

    expect(user.email).toBe('line.u1@no-email.languze.invalid');
  });

  it('gives the same account the same address every time', () => {
    expect(lineProfileToUser({ sub: 'U1' }).email).toBe(
      lineProfileToUser({ sub: 'U1', name: 'renamed' }).email,
    );
  });

  it('keeps no profile picture', () => {
    expect(lineProfileToUser({ sub: 'U1' }).image).toBeUndefined();
  });

  it('refuses a profile without a user ID', () => {
    expect(() => lineProfileToUser({ name: 'นก' })).toThrow();
  });
});
