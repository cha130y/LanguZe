import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { AUTH } from '../src/auth/auth.tokens.js';
import type { Auth } from '../src/auth/create-auth.js';
import type { MeResponseDto } from '../src/auth/dto/auth.dto.js';
import { FakeMailSender } from '../src/notifications/fake-mail-sender.js';
import { MailSender } from '../src/notifications/mail-sender.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const WEB_ORIGIN = 'http://localhost:3003';
const PASSWORD = 'correct horse battery';
const DOMAIN = '@deletion.example.com';

let next = 0;
const freshEmail = () => `learner${++next}.${Date.now()}${DOMAIN}`;

/*
 * Deleting an account must leave nothing behind (FR-007, US-009): the account, its
 * sessions and its provider sign-ins all go, and the browser is signed out. Photos
 * and worlds follow in their own increments, through the same cascade.
 */
// Requires a reachable PostgreSQL database via DATABASE_URL (see docs/deployment/local-development.md).
describe('Deleting an account (e2e)', () => {
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

  /** A signed-in learner with a password and a linked provider sign-in. */
  async function learner() {
    const agent = request.agent(app.getHttpServer());
    const email = freshEmail();
    const response = await agent
      .post('/v1/auth/sign-up')
      .set('Origin', WEB_ORIGIN)
      .send({
        email,
        password: PASSWORD,
        name: 'นก',
        birthYear: adultYear,
        acceptTerms: true,
      })
      .expect(201);

    const userId = (response.body as MeResponseDto).id;
    /*
     * Verified first, or linking a provider would remove the password and end the
     * session — the defence against account pre-hijacking (U6), which has its own
     * tests. Here the learner is simply someone who signs in both ways.
     */
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
    const context = await auth.$context;
    await context.internalAdapter.linkAccount({
      providerId: 'google',
      accountId: `google-subject-${userId}`,
      userId,
    });
    return { agent, email, userId };
  }

  const rowsFor = async (userId: string) => ({
    users: await prisma.user.count({ where: { id: userId } }),
    sessions: await prisma.session.count({ where: { userId } }),
    accounts: await prisma.account.count({ where: { userId } }),
  });

  it('removes the account, its sessions and its provider sign-ins', async () => {
    const { agent, userId } = await learner();
    expect(await rowsFor(userId)).toEqual({
      users: 1,
      sessions: 1,
      accounts: 2,
    });

    await agent
      .delete('/v1/me')
      .set('Origin', WEB_ORIGIN)
      .send({ confirmation: 'DELETE' })
      .expect(204);

    expect(await rowsFor(userId)).toEqual({
      users: 0,
      sessions: 0,
      accounts: 0,
    });
  });

  it('signs the browser out', async () => {
    const { agent } = await learner();

    await agent
      .delete('/v1/me')
      .set('Origin', WEB_ORIGIN)
      .send({ confirmation: 'DELETE' })
      .expect(204);

    await agent.get('/v1/me').expect(401);
  });

  /* The password is gone with the account, so the address is free again (US-009 #4). */
  it('frees the email address for a new account', async () => {
    const { agent, email } = await learner();
    await agent
      .delete('/v1/me')
      .set('Origin', WEB_ORIGIN)
      .send({ confirmation: 'DELETE' })
      .expect(204);

    await request(app.getHttpServer())
      .post('/v1/auth/sign-up')
      .set('Origin', WEB_ORIGIN)
      .send({
        email,
        password: PASSWORD,
        name: 'นก',
        birthYear: adultYear,
        acceptTerms: true,
      })
      .expect(201);
  });

  it.each([
    ['no confirmation', {}],
    ['the wrong word', { confirmation: 'delete' }],
    ['something else entirely', { confirmation: 'ลบบัญชี' }],
  ])('deletes nothing when the request carries %s', async (_case, body) => {
    const { agent, userId } = await learner();

    await agent
      .delete('/v1/me')
      .set('Origin', WEB_ORIGIN)
      .send(body)
      .expect(400);

    expect((await rowsFor(userId)).users).toBe(1);
    await agent.get('/v1/me').expect(200);
  });

  it('refuses a request from nobody', async () => {
    const { userId } = await learner();

    await request(app.getHttpServer())
      .delete('/v1/me')
      .set('Origin', WEB_ORIGIN)
      .send({ confirmation: 'DELETE' })
      .expect(401);

    expect((await rowsFor(userId)).users).toBe(1);
  });

  it('leaves other learners alone', async () => {
    const mine = await learner();
    const theirs = await learner();

    await mine.agent
      .delete('/v1/me')
      .set('Origin', WEB_ORIGIN)
      .send({ confirmation: 'DELETE' })
      .expect(204);

    expect(await rowsFor(theirs.userId)).toEqual({
      users: 1,
      sessions: 1,
      accounts: 2,
    });
    await theirs.agent.get('/v1/me').expect(200);
  });
});
