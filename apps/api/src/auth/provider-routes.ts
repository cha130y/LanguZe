/**
 * The Better Auth endpoints the browser may reach at /auth (ADR-0003). Everything
 * else Better Auth offers there — its own sign-up, sign-in, password reset, profile
 * updates — is also reachable through LanguZe's controllers under /v1/auth, which
 * add the age check, the Terms, validation, and rate limits. Serving those at /auth
 * as well would let a request skip all four, so the handler answers only these, and
 * an endpoint a future Better Auth version adds stays closed until it is listed here.
 */
const PROVIDER_ROUTES: ReadonlyArray<{ method: string; path: RegExp }> = [
  // The web app starts a provider sign-in and receives the provider's address.
  { method: 'POST', path: /^\/sign-in\/social$/ },
  // The provider sends the browser back with the authorization code.
  { method: 'GET', path: /^\/callback\/[a-z]+$/ },
];

/** Whether a request under /auth, given its path below /auth, may reach Better Auth. */
export function isProviderRoute(method: string, path: string): boolean {
  return PROVIDER_ROUTES.some(
    (route) => route.method === method && route.path.test(path),
  );
}
