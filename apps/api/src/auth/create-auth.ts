import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import type { PrismaService } from '../prisma/prisma.service.js';
import { lineProfileToUser } from './line-profile.js';
import { secureLinkedAccount } from './secure-linked-account.js';

export interface AuthDependencies {
  prisma: PrismaService;
  /** Signs cookies and tokens; at least 32 characters (ADR-0003). */
  secret: string;
  /** The API's own address. */
  baseURL: string;
  /** The web app's origin, used for the links in emails and as the trusted origin. */
  webOrigin: string;
  /**
   * The domain to set the session cookie on, so both `languze.com` and
   * `api.languze.com` receive it (H5). Empty on localhost, where the two already
   * share a host and a parent domain would be wrong.
   */
  cookieDomain: string;
  /** Google OAuth credentials; the provider is not offered while either is empty. */
  google: ProviderCredentials;
  /** LINE Login credentials, one channel for Thailand; optional in the same way. */
  line: ProviderCredentials;
  sendVerificationEmail: (to: string, url: string) => Promise<void>;
  sendPasswordResetEmail: (to: string, url: string) => Promise<void>;
}

/** A provider is offered only once both of its values are set. */
export interface ProviderCredentials {
  clientId: string;
  clientSecret: string;
}

const isConfigured = (credentials: ProviderCredentials): boolean =>
  credentials.clientId !== '' && credentials.clientSecret !== '';

/** Path of the Better Auth sign-up endpoint, used to tell email sign-ups from provider sign-ups. */
const EMAIL_SIGN_UP_PATH = '/sign-up/email';

/**
 * The Better Auth instance (ADR-0003). It runs inside the API and owns the four
 * tables of the data model. LanguZe's own rules live in the `auth` module's service:
 * this configuration only sets what Better Auth itself does.
 */
export function createAuth(deps: AuthDependencies) {
  return betterAuth({
    appName: 'LanguZe',
    secret: deps.secret,
    baseURL: deps.baseURL,
    // Reserved for the provider callbacks mounted in a later increment (API design, E1).
    basePath: '/auth',
    trustedOrigins: [deps.webOrigin],
    /*
     * Where a provider callback sends the browser when it fails before the
     * sign-in's own error address is known — a missing or expired state, say.
     * Better Auth's default is its own error page at /auth/error, which the API
     * does not serve (provider-routes.ts). Better Auth appends `?error=<code>`.
     */
    onAPIError: { errorURL: `${deps.webOrigin}/sign-in` },
    database: prismaAdapter(deps.prisma, { provider: 'postgresql' }),
    advanced: {
      // Prisma generates UUID version 7 keys (D5).
      database: { generateId: false },
      /*
       * `secure` is deliberately absent: Better Auth derives it from whether the base
       * URL is HTTPS, and it names the cookie `__Secure-…` on the same condition.
       * Setting it from NODE_ENV instead would produce a `__Secure-` cookie without the
       * Secure attribute whenever the API is served over HTTPS outside production —
       * over a tunnel, for instance — and browsers reject that combination outright.
       */
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax',
      },
      /*
       * Without this the cookie is host-only for the API, and the web app's server
       * never sees it, so every page renders signed out after a reload. The domain
       * has to be given: Better Auth otherwise falls back to the hostname of
       * `baseURL`, which is the API subdomain — the exact value that fails (H5).
       */
      ...(deps.cookieDomain
        ? {
            crossSubDomainCookies: {
              enabled: true,
              domain: deps.cookieDomain,
            },
          }
        : {}),
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8, // V2
      // An unverified learner may sign in and use everything except AI features (FR-006).
      requireEmailVerification: false,
      // A reset may follow a leaked password, so every other device is signed out (S7).
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, token }) => {
        await deps.sendPasswordResetEmail(
          user.email,
          `${deps.webOrigin}/reset-password?token=${encodeURIComponent(token)}`,
        );
      },
    },
    emailVerification: {
      // FR-004: the email goes out as soon as the account exists.
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, token }) => {
        await deps.sendVerificationEmail(
          user.email,
          `${deps.webOrigin}/verify-email?token=${encodeURIComponent(token)}`,
        );
      },
    },
    /*
     * Each provider is offered only once both its credentials exist, so a developer
     * without an OAuth client still gets a working API — the button simply is not
     * there, and `GET /v1/auth/providers` tells the web app which ones to show.
     */
    socialProviders: {
      ...(isConfigured(deps.google)
        ? {
            google: {
              clientId: deps.google.clientId,
              clientSecret: deps.google.clientSecret,
              // LanguZe shows no profile pictures, so Google's is not kept.
              mapProfileToUser: () => ({ image: undefined }),
            },
          }
        : {}),
      ...(isConfigured(deps.line)
        ? {
            line: {
              clientId: deps.line.clientId,
              clientSecret: deps.line.clientSecret,
              /*
               * Better Auth asks LINE for the email address by default. LanguZe
               * cannot use it — LINE never says whether it is verified (FR-009) —
               * and asking needs LINE's approval of the email permission, which
               * would fail the sign-in until granted. So it asks only for what it
               * keeps: the LINE user ID and the display name.
               */
              disableDefaultScope: true,
              scope: ['openid', 'profile'],
              // A LINE account is always stored with a placeholder address (D1, FR-009).
              mapProfileToUser: lineProfileToUser,
            },
          }
        : {}),
    },
    account: {
      accountLinking: {
        enabled: true,
        /*
         * No provider is trusted, so Better Auth links only when the provider
         * says the email is verified (FR-009, U6).
         *
         * `requireLocalEmailVerified` defaults to true, which would refuse the
         * case US-004 criterion 6 describes: a provider-verified email matching
         * a LanguZe account whose own email was never verified. Turning it off
         * allows that link, and it is safe only because the provider's
         * verification is still required, no provider is trusted, and the
         * `account.create.after` hook below removes the password such an account
         * may have been given by someone else (see secure-linked-account.ts).
         * Better Auth marks the email verified itself.
         */
        requireLocalEmailVerified: false,
        trustedProviders: [],
      },
    },
    session: {
      // Role and status are read from the database on every request (NFR-019).
      cookieCache: { enabled: false },
    },
    user: {
      additionalFields: {
        // Never settable through a request: the promotion script sets the role (FR-101),
        // and moderation sets the status (FR-105).
        role: { type: 'string', required: false, input: false },
        status: { type: 'string', required: false, input: false },
        termsAcceptedAt: { type: 'date', required: false, input: false },
        birthYear: { type: 'number', required: false, input: true },
      },
    },
    databaseHooks: {
      account: {
        /*
         * LanguZe never calls a provider's API on a learner's behalf, so it keeps
         * no provider tokens (D3). Clearing them before the row is written means a
         * database copy cannot leak access to someone's Google account.
         */
        create: {
          before: (account) =>
            Promise.resolve({
              data: {
                ...account,
                accessToken: null,
                refreshToken: null,
                idToken: null,
              },
            }),
          // Closes account pre-hijacking when a provider links to an unverified account (U6).
          after: (account) => secureLinkedAccount(deps.prisma, account),
        },
        update: {
          before: (account) =>
            Promise.resolve({
              data: {
                ...account,
                accessToken: null,
                refreshToken: null,
                idToken: null,
              },
            }),
        },
      },
      user: {
        create: {
          before: (user, context) => {
            // Signing up with email means accepting the Terms in the same form (FR-090).
            // Provider sign-ups accept them in a later step, so they start without a time.
            if (context?.path !== EMAIL_SIGN_UP_PATH) return Promise.resolve();
            return Promise.resolve({
              data: { ...user, termsAcceptedAt: new Date() },
            });
          },
        },
      },
    },
    // LanguZe calls these endpoints from its own controllers, so Better Auth sees one
    // caller for every learner and cannot rate limit usefully. The API limits requests
    // per account or IP address instead (API design, section 5).
    rateLimit: { enabled: false },
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof createAuth>;
