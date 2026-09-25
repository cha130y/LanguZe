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
     * Google and LINE get placeholder credentials so both providers exist whether or
     * not a developer has set up OAuth clients. Starting a sign-in only builds the
     * provider's address, so the suite never contacts Google or LINE.
     */
    env: {
      WEB_ORIGIN: 'http://localhost:3003',
      AUTH_URL: 'http://localhost:4001',
      COOKIE_DOMAIN: '',
      GOOGLE_CLIENT_ID: 'e2e-google-client-id',
      GOOGLE_CLIENT_SECRET: 'e2e-google-client-secret',
      LINE_CLIENT_ID: 'e2e-line-client-id',
      LINE_CLIENT_SECRET: 'e2e-line-client-secret',
      /*
       * No Gemini key, whatever the developer's .env says: the suite would
       * otherwise send every test photo to a paid API. The fake provider answers.
       */
      GEMINI_API_KEY: '',
      /*
       * And no delay: a developer who slows the fake provider down to watch the
       * waiting page in the browser would otherwise add that wait to every photo
       * in the suite, twice over — the safety check and the extraction.
       */
      AI_FAKE_DELAY_MS: '0',
      /*
       * Photo storage is pinned to the local SeaweedFS for the same reason: once a
       * developer's .env holds R2 credentials, an unpinned suite would create and
       * delete objects in the real bucket.
       */
      STORAGE_ENDPOINT: 'http://localhost:8334',
      STORAGE_REGION: 'auto',
      STORAGE_BUCKET: 'languze-photos',
      STORAGE_ACCESS_KEY_ID: 'languze',
      STORAGE_SECRET_ACCESS_KEY: 'languze',
      // Low enough that a test can reach the limit without a long loop.
      RATE_LIMIT_PER_MINUTE: '20',
    },
  },
});
