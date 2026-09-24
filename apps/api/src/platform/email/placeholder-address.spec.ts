import { describe, expect, it } from 'vitest';
import {
  isPlaceholderAddress,
  placeholderAddressFor,
} from './placeholder-address.js';

describe('placeholder addresses (D1)', () => {
  it('recognises the reserved domain whatever the case', () => {
    expect(isPlaceholderAddress('a1b2@languze.invalid')).toBe(true);
    expect(isPlaceholderAddress('A1B2@LANGUZE.INVALID')).toBe(true);
    expect(isPlaceholderAddress('nok@example.com')).toBe(false);
    // `.invalid` anywhere but at the end is a real address.
    expect(isPlaceholderAddress('invalid@example.com')).toBe(false);
  });

  it('builds one address per provider identity, always the same', () => {
    const address = placeholderAddressFor('line', 'U4Af4980629');

    expect(address).toBe('line.u4af4980629@no-email.languze.invalid');
    expect(placeholderAddressFor('line', 'U4Af4980629')).toBe(address);
    expect(isPlaceholderAddress(address)).toBe(true);
  });

  it('keeps providers and identities apart', () => {
    expect(placeholderAddressFor('line', 'U1')).not.toBe(
      placeholderAddressFor('facebook', 'U1'),
    );
    expect(placeholderAddressFor('line', 'U1')).not.toBe(
      placeholderAddressFor('line', 'U2'),
    );
  });
});
