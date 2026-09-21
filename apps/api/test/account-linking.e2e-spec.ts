import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { AUTH } from '../src/auth/auth.tokens.js';
import type { Auth } from '../src/auth/create-auth.js';
import type { MeResponseDto } from '../src/auth/dto/auth.dto.js';
import { CREDENTIAL_PROVIDER } from '../src/auth/secure-linked-account.js';
import { FakeMailSender } from '../src/notifications/fake-mail-sender.js';
import { MailSender } from '../src/notifications/mail-sender.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const WEB_ORIGIN = 'http://localhost:3003';
const PASSWORD = 'correct horse battery';
const DOMAIN = '@linking.example.com';

let next = 0;
const freshEmail = () => `owner${++next}.${Date.now()}${DOMAIN}`;

/*
 * Account pre-hijacking (US-004 criterion 6, U6). Someone signs up with another
 * person's email and a password they chose, but cannot verify it. When the real
 * owner later signs in with a provider that proves the address, the sign-in links to
 * that account — and the password someone else chose must stop working.
 *
 * A real provider round trip needs Google, so the link is made through Better Auth's
 * own adapter instead. That is the same path the provider callback takes, so it runs
 * the database hooks for real: this proves the rule is wired, not only written.
 */
// Requires a reachable PostgreSQL database via DATABASE_URL (see docs/deployment/local-development.md).
describe('Linking a provider to an existing account (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let auth: Auth;
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
    rateLimits = app.get<{ storage: Map<string, unknown> }>(
      ThrottlerStorage,
    ).storage;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
    await app.close();
  });

  beforeEach(() => rateLimits.clear());

  /** An account with a password and an email nobody has verified — signed in. */
  async function unverifiedPasswordAccount() {
    const agent = request.agent(app.getHttpServer());
    const email = freshEmail();
    const response = await agent
      .post('/v1/auth/sign-up')
      .set('Origin', WEB_ORIGIN)
      .send({
        email,
        password: PASSWORD,
        name: 'Somebody',
        birthYear: adultYear,
        acceptTerms: true,
      })
      .expect(201);
    return { agent, email, userId: (response.body as MeResponseDto).id };
  }

  /** What the provider callback does when a verified email matches an account. */
  async function linkGoogle(userId: string): Promise<void> {
    const context = await auth.$context;
    await context.internalAdapter.linkAccount({
      providerId: 'google',
      accountId: `google-subject-${userId}`,
      userId,
    });
  }

  const passwordCount = (userId: string) =>
    prisma.account.count({
      where: { userId, providerId: CREDENTIAL_PROVIDER },
    });

  it('removes a password that nobody proved they owned the email for', async () => {
    const { userId } = await unverifiedPasswordAccount();
    expect(await passwordCount(userId)).toBe(1);

    await linkGoogle(userId);

    expect(await passwordCount(userId)).toBe(0);
  });

  it('ends the sessions that password already opened', async () => {
    const { agent, userId } = await unverifiedPasswordAccount();
    await agent.get('/v1/me').expect(200);

    await linkGoogle(userId);

    await agent.get('/v1/me').expect(401);
  });

  it('refuses the old password afterwards', async () => {
    const { email, userId } = await unverifiedPasswordAccount();

    await linkGoogle(userId);

    await request(app.getHttpServer())
      .post('/v1/auth/sign-in')
      .set('Origin', WEB_ORIGIN)
      .send({ email, password: PASSWORD })
      .expect(401);
  });

  /*
   * The owner already proved the address, so their password is theirs. Removing it
   * here would lock someone out of a sign-in method they set up legitimately.
   */
  it('keeps the password when the email was already verified', async () => {
    const { userId } = await unverifiedPasswordAccount();
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });

    await linkGoogle(userId);

    expect(await passwordCount(userId)).toBe(1);
  });
});
