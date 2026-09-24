/**
 * Every account needs an email address, but LINE and Facebook may share none
 * (FR-009). Such accounts get a placeholder built from the provider and the
 * provider's user ID, on the domain below (D1).
 *
 * RFC 2606 reserves `.invalid` so that it can never resolve, which is what makes
 * the address safe: no mail can reach it even by accident. The API treats any
 * address ending in `.invalid` as "no email address": nothing is sent to it, it is
 * never shown to the learner, and sign-up refuses it.
 */
const PLACEHOLDER_DOMAIN = 'no-email.languze.invalid';
const PLACEHOLDER_DOMAIN_SUFFIX = '.invalid';

export const isPlaceholderAddress = (address: string): boolean =>
  address.toLowerCase().endsWith(PLACEHOLDER_DOMAIN_SUFFIX);

/**
 * The placeholder for one provider identity. The same identity always produces the
 * same address, so a returning learner is found again, and two learners can never
 * collide: the provider's user ID is unique within the provider.
 *
 * Lower case throughout, because email addresses are compared that way.
 */
export const placeholderAddressFor = (
  providerId: string,
  providerAccountId: string,
): string =>
  `${providerId}.${providerAccountId}@${PLACEHOLDER_DOMAIN}`.toLowerCase();
