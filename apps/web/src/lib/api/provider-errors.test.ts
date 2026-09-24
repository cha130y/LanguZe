import { describe, expect, it } from 'vitest';
import { messageForProviderError } from './provider-errors';

describe('a provider sign-in that did not finish (US-004)', () => {
  it('says nothing when nothing went wrong', () => {
    expect(messageForProviderError(undefined)).toBeNull();
    expect(messageForProviderError('')).toBeNull();
  });

  it('says so plainly when the learner cancelled', () => {
    expect(messageForProviderError('access_denied')).toContain('ยกเลิก');
  });

  it('falls back to one general message for anything else', () => {
    expect(messageForProviderError('unable_to_link_account')).toBe(
      messageForProviderError('no_code'),
    );
  });

  it('reads the last value when the parameter repeats', () => {
    expect(messageForProviderError(['provider', 'access_denied'])).toBe(
      messageForProviderError('access_denied'),
    );
  });
});
