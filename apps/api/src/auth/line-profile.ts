import { placeholderAddressFor } from '../platform/email/placeholder-address.js';

export const LINE_PROVIDER = 'line';

/** What LINE's ID token holds. Only `sub`, the LINE user ID, is always present. */
export interface LineProfile {
  sub?: unknown;
  name?: unknown;
  email?: unknown;
}

/**
 * What LanguZe stores for a LINE sign-in (FR-009, D1).
 *
 * LINE never states whether an address is verified, so Better Auth reports every
 * LINE email as unverified — and FR-009 links accounts only on a provider-verified
 * address. A LINE email therefore cannot be used as the account's address, whether
 * LINE shares one or not, and the account gets a placeholder instead.
 *
 * Two consequences, both intended: a LINE sign-in never joins an existing account
 * (US-005 criterion 3), and a LINE account receives no email and has no password
 * reset (US-005 criterion 2). Signing in with LINE still counts as verified for the
 * AI features (V13), which `me` derives from having a provider sign-in at all.
 */
export function lineProfileToUser(profile: LineProfile): {
  email: string;
  emailVerified: false;
  image: undefined;
} {
  const sub = typeof profile.sub === 'string' ? profile.sub : '';
  if (!sub) {
    // Better Auth cannot create an account without one, and neither can LanguZe.
    throw new Error('LINE returned a profile without a user ID.');
  }

  return {
    email: placeholderAddressFor(LINE_PROVIDER, sub),
    emailVerified: false,
    // LanguZe shows no profile pictures, so none is kept (data model, `users.image`).
    image: undefined,
  };
}
