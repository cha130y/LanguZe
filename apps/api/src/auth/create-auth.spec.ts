import type { PrismaService } from '../prisma/prisma.service.js';
import { createAuth, type AuthDependencies } from './create-auth.js';

/**
 * The session cookie has to reach both the web app and the API in production (H5).
 * Locally they share a host, so the bug this guards against cannot appear until the
 * two run on `languze.com` and `api.languze.com` — which is why it is tested here.
 */
const deps = (cookieDomain: string): AuthDependencies => ({
  // Better Auth only reads the adapter when it serves a request, and these tests
  // never do, so a bare object stands in for the real client.
  prisma: {} as PrismaService,
  secret: 'test-secret-test-secret-test-sec',
  baseURL: 'https://api.languze.com',
  webOrigin: 'https://languze.com',
  isProduction: true,
  cookieDomain,
  sendVerificationEmail: async () => {},
  sendPasswordResetEmail: async () => {},
});

const sessionCookie = async (cookieDomain: string) => {
  const auth = createAuth(deps(cookieDomain));
  const context = await auth.$context;
  return context.authCookies.sessionToken.attributes;
};

describe('session cookie', () => {
  it('is set on the parent domain so both subdomains receive it', async () => {
    const attributes = await sessionCookie('.languze.com');

    expect(attributes.domain).toBe('.languze.com');
  });

  it('stays host-only when no domain is configured', async () => {
    const attributes = await sessionCookie('');

    // On localhost the web app and the API share a host already.
    expect(attributes.domain).toBeUndefined();
  });

  it('keeps the attributes that protect the session', async () => {
    const attributes = await sessionCookie('.languze.com');

    expect(attributes.httpOnly).toBe(true);
    expect(attributes.secure).toBe(true);
    // Lax is enough: both hosts are the same site, so the request is not cross-site.
    expect(attributes.sameSite).toBe('lax');
  });
});
