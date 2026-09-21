import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import type { PrismaService } from '../prisma/prisma.service.js';

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
  sendVerificationEmail: (to: string, url: string) => Promise<void>;
  sendPasswordResetEmail: (to: string, url: string) => Promise<void>;
}

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
