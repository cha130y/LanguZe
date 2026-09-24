import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { AuthService } from '../src/auth/auth.service.js';
import { AUTH } from '../src/auth/auth.tokens.js';
import type { Auth } from '../src/auth/create-auth.js';
import { lineProfileToUser } from '../src/auth/line-profile.js';
import { FakeMailSender } from '../src/notifications/fake-mail-sender.js';
import { MailSender } from '../src/notifications/mail-sender.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const WEB_ORIGIN = 'http://localhost:3003';
const PASSWORD = 'correct horse battery';
const DOMAIN = '@line.example.com';
/** Placeholder addresses this suite creates, so cleanup can find them again. */
const SUBJECT_PREFIX = 'Ue2e';

let next = 0;
const freshSubject = () => `${SUBJECT_PREFIX}${++next}${Date.now()}`;

/*
 * LINE never says whether an address is verified, so FR-009 forbids using one:
 * every LINE account is stored with a placeholder address (D1) and stands alone
 * (US-005). These tests drive Better Auth's own adapter, the path the provider
 * callback takes for a new account, so the database hooks run for real.
 */
// Requires a reachable PostgreSQL database via DATABASE_URL (see docs/deployment/local-development.md).
describe('Signing in with LINE (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let auth: Auth;
  let authService: AuthService;
  let rateLimits: Map<string, unknown>;
  const adultYear = new Date().getFullYear() - 25;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailSender)
      .useValue(new FakeMailSender())
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: false,
      bodyParser: false,
    });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    auth = app.get<Auth>(AUTH);
    authService = app.get(AuthService);
    rateLimits = app.get<{ storage: Map<string, unknown> }>(
      ThrottlerStorage,
    ).storage;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: { endsWith: DOMAIN } },
          { email: { startsWith: `line.${SUBJECT_PREFIX.toLowerCase()}` } },
        ],
      },
    });
    await app.close();
  });

  beforeEach(() => rateLimits.clear());

  /** What the provider callback does for a LINE identity it has not seen before. */
  async function signInWithLine(profile: { sub: string; email?: string }) {
    const context = await auth.$context;
    const { user } = await context.internalAdapter.createOAuthUser(
      { name: 'นก', ...lineProfileToUser(profile) },
      {
        providerId: 'line',
        accountId: profile.sub,
        // What LINE returns; the hooks must drop all three before they are stored.
        accessToken: 'line-access-token',
        refreshToken: 'line-refresh-token',
        idToken: 'line-id-token',
      },
    );
    return user;
  }

  it('stores a placeholder address instead of the one LINE shared', async () => {
    const user = await signInWithLine({
      sub: freshSubject(),
      email: `shared${Date.now()}${DOMAIN}`,
    });

    expect(user.email).toMatch(/^line\..+@no-email\.languze\.invalid$/);
    expect(user.emailVerified).toBe(false);
  });

  /*
   * US-005 criterion 3. The learner may use the same address at LINE and at
   * LanguZe, but LINE has not proved they own it, so the accounts stay apart.
   */
  it('never joins an account that already uses that address', async () => {
    const email = `owner${Date.now()}${DOMAIN}`;
    const owner = await request(app.getHttpServer())
      .post('/v1/auth/sign-up')
      .set('Origin', WEB_ORIGIN)
      .send({
        email,
        password: PASSWORD,
        name: 'Owner',
        birthYear: adultYear,
        acceptTerms: true,
      })
      .expect(201);

    const lineUser = await signInWithLine({ sub: freshSubject(), email });

    expect(lineUser.id).not.toBe((owner.body as { id: string }).id);
    expect(await prisma.user.count({ where: { email } })).toBe(1);
  });

  /** D1: the address exists only to fill the column, so the learner never sees it. */
  it('shows no email address, and still unlocks the AI features', async () => {
    const user = await signInWithLine({ sub: freshSubject() });

    const account = await authService.me(user.id);

    expect(account.email).toBeNull();
    expect(account.emailVerified).toBe(false);
    // Signing in with LINE counts as verified (V13).
    expect(account.verifiedForAi).toBe(true);
  });

  /** Placeholder addresses are guessable, so sign-up must never accept one. */
  it('refuses a sign-up that claims a placeholder address', async () => {
    const email = `line.${freshSubject().toLowerCase()}@no-email.languze.invalid`;

    await request(app.getHttpServer())
      .post('/v1/auth/sign-up')
      .set('Origin', WEB_ORIGIN)
      .send({
        email,
        password: PASSWORD,
        name: 'Impostor',
        birthYear: adultYear,
        acceptTerms: true,
      })
      .expect(400);

    expect(await prisma.user.count({ where: { email } })).toBe(0);
  });

  it('keeps no provider tokens for a LINE account (D3)', async () => {
    const user = await signInWithLine({ sub: freshSubject() });

    const account = await prisma.account.findFirstOrThrow({
      where: { userId: user.id, providerId: 'line' },
    });

    expect(account.accessToken).toBeNull();
    expect(account.refreshToken).toBeNull();
    expect(account.idToken).toBeNull();
  });

  it('tells the web app which providers it offers', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/auth/providers')
      .expect(200);

    expect(response.body).toEqual({ providers: ['google', 'line'] });
  });
});
