import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { FakeMailSender } from '../src/notifications/fake-mail-sender.js';
import { MailSender } from '../src/notifications/mail-sender.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const WEB_ORIGIN = 'http://localhost:3003';
const DOMAIN = '@handler.example.com';

/*
 * Better Auth's HTTP handler answers every endpoint Better Auth has, not only the
 * provider routes it is mounted for. LanguZe's own controllers put the age check,
 * the Terms, validation, and rate limits in front of those same operations, so
 * reaching them at /auth directly would skip all four (ADR-0003).
 */
// Requires a reachable PostgreSQL database via DATABASE_URL (see docs/deployment/local-development.md).
describe('Better Auth handler at /auth (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const childYear = new Date().getFullYear() - 10;

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
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
    await app.close();
  });

  describe('closed routes', () => {
    it('does not create an account through Better Auth’s own sign-up', async () => {
      const email = `child.${Date.now()}${DOMAIN}`;
      const response = await request(app.getHttpServer())
        .post('/auth/sign-up/email')
        .set('Origin', WEB_ORIGIN)
        .send({
          email,
          password: 'correct horse battery',
          name: 'Child',
          birthYear: childYear,
        })
        .expect(404);

      expect(response.body).toMatchObject({ error: { code: 'NOT_FOUND' } });
      expect(await prisma.user.count({ where: { email } })).toBe(0);
    });

    it.each([
      ['POST', '/auth/sign-in/email'],
      ['POST', '/auth/request-password-reset'],
      ['POST', '/auth/send-verification-email'],
      ['POST', '/auth/update-user'],
      ['POST', '/auth/change-password'],
      ['POST', '/auth/sign-out'],
      ['GET', '/auth/get-session'],
      ['GET', '/auth/list-accounts'],
      ['GET', '/auth/error'],
      ['GET', '/auth/ok'],
      // Google, LINE and Facebook return to a GET; the POST form is not needed.
      ['POST', '/auth/callback/google'],
    ])('answers %s %s with NOT_FOUND', async (method, path) => {
      const server = request(app.getHttpServer());
      const call =
        method === 'GET' ? server.get(path) : server.post(path).send({});
      const response = await call.set('Origin', WEB_ORIGIN).expect(404);

      expect(response.body).toMatchObject({ error: { code: 'NOT_FOUND' } });
    });
  });

  describe('provider routes', () => {
    it('starts a provider sign-in', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/sign-in/social')
        .set('Origin', WEB_ORIGIN)
        .send({ provider: 'google', callbackURL: `${WEB_ORIGIN}/` })
        .expect(200);

      const body = response.body as { url: string };
      expect(new URL(body.url).origin).toBe('https://accounts.google.com');
    });

    it('sends a failed callback back to the web app’s sign-in page', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/callback/google')
        .expect(302);

      const location = new URL(response.headers.location);
      expect(location.origin + location.pathname).toBe(`${WEB_ORIGIN}/sign-in`);
      expect(location.searchParams.get('error')).toBe('state_not_found');
    });
  });
});
