import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    /*
     * The suite talks to the application over localhost, so it pins the addresses
     * it depends on rather than reading whatever a developer's .env happens to say.
     * Without this, pointing .env at the tunnel — a normal thing to do — makes the
     * origin check and the session cookie fail in ways that look like broken code.
     * DATABASE_URL is deliberately left alone: the suite needs a real database.
     *
     * Google gets placeholder credentials so the provider exists whether or not a
     * developer has set up an OAuth client. Starting a sign-in only builds Google's
     * address, so the suite never contacts Google.
     */
    env: {
      WEB_ORIGIN: 'http://localhost:3003',
      AUTH_URL: 'http://localhost:4001',
      COOKIE_DOMAIN: '',
      GOOGLE_CLIENT_ID: 'e2e-google-client-id',
      GOOGLE_CLIENT_SECRET: 'e2e-google-client-secret',
    },
  },
});
