import type { PrismaService } from '../prisma/prisma.service.js';

/** Better Auth's provider id for an email-and-password sign-in. */
export const CREDENTIAL_PROVIDER = 'credential';

/**
 * Closes account pre-hijacking when a provider sign-in links to an existing account
 * whose email was never verified (US-004 criterion 6, U6).
 *
 * Someone can sign up with another person's email and a password of their own
 * choosing. They cannot verify the address, but the account exists. When the real
 * owner later signs in with Google, the provider proves the address, and Better Auth
 * links the sign-in to that account and marks the email verified — but leaves the
 * password in place, so whoever chose it could still sign in to what is now the
 * owner's account. This removes the password and ends every session it opened.
 *
 * It runs as the provider account is written. That is after the link but before
 * Better Auth marks the email verified, and before the owner's own session is
 * created, so an unverified email here means exactly this case and ending the
 * existing sessions never signs the owner out.
 */
export async function secureLinkedAccount(
  prisma: PrismaService,
  account: { userId: string; providerId: string },
): Promise<void> {
  if (account.providerId === CREDENTIAL_PROVIDER) return;

  const user = await prisma.user.findUnique({
    where: { id: account.userId },
    select: {
      emailVerified: true,
      accounts: {
        where: { providerId: CREDENTIAL_PROVIDER },
        select: { id: true },
      },
    },
  });

  // Nothing to secure: the address was already proven, or no password was ever set.
  if (!user || user.emailVerified || user.accounts.length === 0) return;

  // Together, so there is never a moment with the password gone but its sessions live.
  await prisma.$transaction([
    prisma.account.deleteMany({
      where: { userId: account.userId, providerId: CREDENTIAL_PROVIDER },
    }),
    prisma.session.deleteMany({ where: { userId: account.userId } }),
  ]);
}
