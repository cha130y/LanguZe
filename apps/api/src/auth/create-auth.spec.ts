import type { PrismaService } from '../prisma/prisma.service.js';
import { createAuth, type Auth, type AuthDependencies } from './create-auth.js';

/**
 * The session cookie has to reach both the web app and the API in production (H5),
 * and has to be accepted by the browser wherever the API is served over HTTPS.
 * Locally the two applications share a host and speak HTTP, so neither bug can appear
 * until they run on `languze.com` and `api.languze.com` — which is why they are
 * tested here rather than left to a deployment to reveal.
 */
const deps = (
  cookieDomain: string,
  baseURL = 'https://api.languze.com',
): AuthDependencies => ({
  // Better Auth only reads the adapter when it serves a request, and these tests
  // never do, so a bare object stands in for the real client.
  prisma: {} as PrismaService,
  secret: 'test-secret-test-secret-test-sec',
  baseURL,
  webOrigin: 'https://languze.com',
  cookieDomain,
  google: { clientId: '', clientSecret: '' },
  line: { clientId: '', clientSecret: '' },
  sendVerificationEmail: async () => {},
  sendPasswordResetEmail: async () => {},
});

const sessionCookie = async (cookieDomain: string, baseURL?: string) => {
  const auth = createAuth(deps(cookieDomain, baseURL));
  const context = await auth.$context;
  return context.authCookies.sessionToken;
};

describe('session cookie', () => {
  it('is set on the parent domain so both subdomains receive it', async () => {
    const { attributes } = await sessionCookie('.languze.com');

    expect(attributes.domain).toBe('.languze.com');
  });

  it('stays host-only when no domain is configured', async () => {
    const { attributes } = await sessionCookie('');

    // On localhost the web app and the API share a host already.
    expect(attributes.domain).toBeUndefined();
  });

  it('keeps the attributes that protect the session', async () => {
    const { attributes } = await sessionCookie('.languze.com');

    expect(attributes.httpOnly).toBe(true);
    // Lax is enough: both hosts are the same site, so the request is not cross-site.
    expect(attributes.sameSite).toBe('lax');
  });

  /*
   * A `__Secure-` cookie without the Secure attribute is rejected by every browser,
   * so the prefix and the attribute have to be decided by the same thing: whether the
   * API is served over HTTPS. Deciding `secure` from NODE_ENV instead breaks sign-in
   * silently wherever HTTPS is used outside production, such as over a tunnel.
   */
  it('is Secure and prefixed together when the API is served over HTTPS', async () => {
    const { name, attributes } = await sessionCookie(
      '.languze.com',
      'https://api.languze.com',
    );

    expect(attributes.secure).toBe(true);
    expect(name.startsWith('__Secure-')).toBe(true);
  });

  it('is neither Secure nor prefixed on plain HTTP', async () => {
    const { name, attributes } = await sessionCookie(
      '',
      'http://localhost:4001',
    );

    expect(attributes.secure).toBe(false);
    expect(name.startsWith('__Secure-')).toBe(false);
  });
});

const withProviders = (
  providers: Partial<Pick<AuthDependencies, 'google' | 'line'>>,
): Auth => createAuth({ ...deps(''), ...providers });

const credentials = { clientId: 'client', clientSecret: 'secret' };

/** An ID token the way LINE returns one; only its payload is ever read. */
const idTokenFor = (payload: Record<string, unknown>) =>
  [
    'eyJhbGciOiJIUzI1NiJ9',
    Buffer.from(JSON.stringify(payload)).toString('base64url'),
    'signature',
  ].join('.');

describe('providers on offer (FR-003)', () => {
  it('offers only the ones with credentials', () => {
    const auth = withProviders({ line: credentials });

    expect(Object.keys(auth.options.socialProviders ?? {})).toEqual(['line']);
  });

  it('offers none at all without credentials', () => {
    expect(
      Object.keys(withProviders({}).options.socialProviders ?? {}),
    ).toEqual([]);
  });

  /*
   * The mapping is what keeps LINE's address out of the database (D1, FR-009), so
   * this drives the provider Better Auth built rather than the mapping alone: a
   * mapping that is written but not wired would pass the one and fail the other.
   */
  it('stores a LINE sign-in under a placeholder address', async () => {
    const auth = withProviders({ line: credentials });
    const context = await auth.$context;
    const line = context.socialProviders.find(
      (provider) => provider.id === 'line',
    );

    const info = await line?.getUserInfo({
      idToken: idTokenFor({
        sub: 'U4af4980629',
        name: 'นก',
        email: 'nok@example.com',
      }),
      accessToken: 'line-access-token',
    });

    expect(info?.user.email).toBe('line.u4af4980629@no-email.languze.invalid');
    expect(info?.user.emailVerified).toBe(false);
  });

  it('keeps no profile picture from Google', () => {
    const google = withProviders({ google: credentials }).options
      .socialProviders?.google;

    expect(google?.mapProfileToUser?.()).toEqual({
      image: undefined,
    });
  });

  /*
   * Asking LINE for the email address needs LINE's approval of the email
   * permission, and LanguZe never keeps the answer, so the request must not
   * include it: an unapproved scope would fail the sign-in for nothing.
   */
  it('asks LINE only for what it keeps', async () => {
    const auth = withProviders({ line: credentials });
    const context = await auth.$context;
    const line = context.socialProviders.find(
      (provider) => provider.id === 'line',
    );

    const url = await line?.createAuthorizationURL({
      state: 'state',
      codeVerifier: 'verifier',
      redirectURI: 'https://api.languze.com/auth/callback/line',
    });

    expect(url?.searchParams.get('scope')).toBe('openid profile');
  });
});
