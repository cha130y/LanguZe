import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { FakeMailSender } from '../src/notifications/fake-mail-sender.js';
import { MailSender } from '../src/notifications/mail-sender.js';
import type {
  ErrorBodyDto,
  ErrorResponseDto,
} from '../src/platform/errors/error-response.dto.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import type { MeResponseDto } from '../src/auth/dto/auth.dto.js';

const WEB_ORIGIN = 'http://localhost:3003';
const PASSWORD = 'correct horse battery';

function errorOf(response: request.Response): ErrorBodyDto {
  return (response.body as ErrorResponseDto).error;
}

function meOf(response: request.Response): MeResponseDto {
  return response.body as MeResponseDto;
}

function tokenFrom(text: string | undefined): string {
  const match = /token=([^\s&]+)/.exec(text ?? '');
  if (!match) throw new Error(`No token in email: ${text ?? '(no email)'}`);
  return decodeURIComponent(match[1]);
}

let nextAddress = 0;
const freshEmail = () => `learner${++nextAddress}.${Date.now()}@example.com`;

// Requires a reachable PostgreSQL database via DATABASE_URL (see docs/deployment/local-development.md).
describe('Email sign-up and sign-in (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const mail = new FakeMailSender();
  // Rate limiting stays switched on, but its counters are cleared between tests, so a
  // file full of sign-in attempts does not look like one attack (API design, section 5).
  let rateLimits: Map<string, unknown>;
  const adultYear = new Date().getFullYear() - 25;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Email never leaves the test; the fake keeps what would have been sent.
      .overrideProvider(MailSender)
      .useValue(mail)
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: false,
      bodyParser: false,
    });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    // The in-memory storage keeps one entry per limit key; clearing it resets the counters.
    rateLimits = app.get<{ storage: Map<string, unknown> }>(
      ThrottlerStorage,
    ).storage;
  });

  afterAll(async () => {
    // Only what this file created. The suite shares the development database, so an
    // unscoped delete would wipe the accounts a developer signs in with by hand.
    await prisma.user.deleteMany({
      where: { email: { endsWith: '@example.com' } },
    });
    await prisma.verification.deleteMany({
      where: { identifier: { contains: '@example.com' } },
    });
    await app.close();
  });

  beforeEach(() => {
    mail.clear();
    rateLimits.clear();
  });

  function signUp(
    agent: ReturnType<typeof request.agent>,
    body: Record<string, unknown>,
  ) {
    return agent.post('/v1/auth/sign-up').set('Origin', WEB_ORIGIN).send(body);
  }

  async function signedUpLearner(): Promise<{
    agent: ReturnType<typeof request.agent>;
    email: string;
  }> {
    const agent = request.agent(app.getHttpServer());
    const email = freshEmail();
    await signUp(agent, {
      email,
      password: PASSWORD,
      name: 'Nok',
      birthYear: adultYear,
      acceptTerms: true,
    }).expect(201);
    return { agent, email };
  }

  describe('signing up (US-001)', () => {
    it('creates the account, signs the learner in, and sends a verification email', async () => {
      const agent = request.agent(app.getHttpServer());
      const email = freshEmail();

      const response = await signUp(agent, {
        email,
        password: PASSWORD,
        name: 'Nok',
        birthYear: adultYear,
        acceptTerms: true,
      }).expect(201);

      expect(meOf(response)).toMatchObject({
        email,
        name: 'Nok',
        emailVerified: false,
        verifiedForAi: false,
        role: 'LEARNER',
        termsAccepted: true,
        aiAccess: { available: false, reason: 'NOT_VERIFIED' },
      });
      // The session cookie came back, so the learner is signed in (US-001 criterion 1).
      await agent.get('/v1/me').expect(200);
      expect(mail.lastTo(email)?.subject).toContain('ยืนยันอีเมล');

      const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(stored.birthYear).toBe(adultYear);
      expect(stored.termsAcceptedAt).not.toBeNull();
      expect(stored.status).toBe('ACTIVE');
    });

    it('refuses without accepting the Terms of Use', async () => {
      const response = await signUp(request.agent(app.getHttpServer()), {
        email: freshEmail(),
        password: PASSWORD,
        name: 'Nok',
        birthYear: adultYear,
        acceptTerms: false,
      }).expect(400);

      expect(errorOf(response).code).toBe('TERMS_NOT_ACCEPTED');
    });

    it('refuses someone who does not turn 18 this year, and blocks a second try', async () => {
      const agent = request.agent(app.getHttpServer());
      const tooYoung = new Date().getFullYear() - 17;

      const refusal = await signUp(agent, {
        email: freshEmail(),
        password: PASSWORD,
        name: 'Nok',
        birthYear: tooYoung,
        acceptTerms: true,
      }).expect(403);
      expect(errorOf(refusal).code).toBe('AGE_BELOW_MINIMUM');

      // The same browser cannot simply try again with another year (V20).
      const retry = await signUp(agent, {
        email: freshEmail(),
        password: PASSWORD,
        name: 'Nok',
        birthYear: adultYear,
        acceptTerms: true,
      }).expect(403);
      expect(errorOf(retry).code).toBe('AGE_BELOW_MINIMUM');
      expect(mail.sent).toHaveLength(0);
    });

    it('tells the learner when the address already has an account', async () => {
      const { email } = await signedUpLearner();

      const response = await signUp(request.agent(app.getHttpServer()), {
        email,
        password: PASSWORD,
        name: 'Someone else',
        birthYear: adultYear,
        acceptTerms: true,
      }).expect(409);

      expect(errorOf(response).code).toBe('EMAIL_ALREADY_REGISTERED');
    });

    it('checks the password length and the display name', async () => {
      const response = await signUp(request.agent(app.getHttpServer()), {
        email: freshEmail(),
        password: 'short',
        name: '',
        birthYear: adultYear,
        acceptTerms: true,
      }).expect(400);

      expect(errorOf(response).code).toBe('VALIDATION_FAILED');
      expect(
        (
          errorOf(response).details as { fields: { field: string }[] }
        ).fields.map((f) => f.field),
      ).toEqual(expect.arrayContaining(['password', 'name']));
    });
  });

  describe('verifying the email address (US-002)', () => {
    it('unlocks AI features with the token from the email', async () => {
      const { agent, email } = await signedUpLearner();
      const token = tokenFrom(mail.lastTo(email)?.text);

      await agent
        .post('/v1/auth/verify-email')
        .set('Origin', WEB_ORIGIN)
        .send({ token })
        .expect(200);

      const me = meOf(await agent.get('/v1/me').expect(200));
      expect(me).toMatchObject({
        emailVerified: true,
        verifiedForAi: true,
        aiAccess: { available: true, reason: null },
      });
    });

    it('refuses a token that is not valid', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/verify-email')
        .set('Origin', WEB_ORIGIN)
        .send({ token: 'not-a-real-token' })
        .expect(400);

      expect(errorOf(response).code).toBe('INVALID_TOKEN');
    });

    it('sends a new verification email on request, and answers the same for unknown addresses', async () => {
      const { email } = await signedUpLearner();
      mail.clear();

      await request(app.getHttpServer())
        .post('/v1/auth/send-verification-email')
        .set('Origin', WEB_ORIGIN)
        .send({ email })
        .expect(200, { ok: true });
      expect(mail.lastTo(email)).toBeDefined();

      await request(app.getHttpServer())
        .post('/v1/auth/send-verification-email')
        .set('Origin', WEB_ORIGIN)
        .send({ email: 'nobody@example.com' })
        .expect(200, { ok: true });
      expect(mail.lastTo('nobody@example.com')).toBeUndefined();
    });
  });

  describe('signing in and out (US-003)', () => {
    it('signs in with the right password', async () => {
      const { email } = await signedUpLearner();
      const agent = request.agent(app.getHttpServer());

      const response = await agent
        .post('/v1/auth/sign-in')
        .set('Origin', WEB_ORIGIN)
        .send({ email, password: PASSWORD })
        .expect(200);

      expect(meOf(response).email).toBe(email);
      await agent.get('/v1/me').expect(200);
    });

    it.each([
      [
        'a wrong password',
        (email: string) => ({ email, password: 'wrong password' }),
      ],
      [
        'an unknown address',
        () => ({ email: 'nobody@example.com', password: PASSWORD }),
      ],
    ])('refuses %s with the same answer', async (_label, body) => {
      const { email } = await signedUpLearner();

      const response = await request(app.getHttpServer())
        .post('/v1/auth/sign-in')
        .set('Origin', WEB_ORIGIN)
        .send(body(email))
        .expect(401);

      expect(errorOf(response).code).toBe('INVALID_CREDENTIALS');
    });

    it('signs out, after which the session no longer works', async () => {
      const { agent } = await signedUpLearner();

      await agent
        .post('/v1/auth/sign-out')
        .set('Origin', WEB_ORIGIN)
        .expect(204);

      const response = await agent.get('/v1/me').expect(401);
      expect(errorOf(response).code).toBe('NOT_SIGNED_IN');
    });

    it('refuses a suspended account, and ends its sessions', async () => {
      const { agent, email } = await signedUpLearner();
      await prisma.user.update({
        where: { email },
        data: { status: 'SUSPENDED' },
      });

      const response = await request(app.getHttpServer())
        .post('/v1/auth/sign-in')
        .set('Origin', WEB_ORIGIN)
        .send({ email, password: PASSWORD })
        .expect(403);
      expect(errorOf(response).code).toBe('ACCOUNT_SUSPENDED');

      // The session created before the suspension is gone too (FR-105).
      await agent.get('/v1/me').expect(401);
    });
  });

  describe('resetting a forgotten password (US-007)', () => {
    it('sends a link, sets the new password, and signs every device out', async () => {
      const { agent, email } = await signedUpLearner();

      await request(app.getHttpServer())
        .post('/v1/auth/request-password-reset')
        .set('Origin', WEB_ORIGIN)
        .send({ email })
        .expect(200, { ok: true });

      const token = tokenFrom(mail.lastTo(email)?.text);
      await request(app.getHttpServer())
        .post('/v1/auth/reset-password')
        .set('Origin', WEB_ORIGIN)
        .send({ token, newPassword: 'a brand new password' })
        .expect(200, { ok: true });

      // Every other device was signed out (S7).
      await agent.get('/v1/me').expect(401);

      await request(app.getHttpServer())
        .post('/v1/auth/sign-in')
        .set('Origin', WEB_ORIGIN)
        .send({ email, password: 'a brand new password' })
        .expect(200);
    });

    it('answers the same for an address without an account, and sends nothing', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/request-password-reset')
        .set('Origin', WEB_ORIGIN)
        .send({ email: 'nobody@example.com' })
        .expect(200, { ok: true });

      expect(mail.sent).toHaveLength(0);
    });

    it('refuses a reset token that is not valid', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/reset-password')
        .set('Origin', WEB_ORIGIN)
        .send({ token: 'not-a-real-token', newPassword: 'another password' })
        .expect(400);

      expect(errorOf(response).code).toBe('INVALID_TOKEN');
    });
  });

  describe('the account endpoint (US-008)', () => {
    it('needs a session', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/me')
        .expect(401);
      expect(errorOf(response).code).toBe('NOT_SIGNED_IN');
    });

    it('reports that AI features are locked until the email is verified', async () => {
      const { agent } = await signedUpLearner();

      expect(meOf(await agent.get('/v1/me').expect(200)).aiAccess).toEqual({
        available: false,
        reason: 'NOT_VERIFIED',
      });
    });
  });
});
