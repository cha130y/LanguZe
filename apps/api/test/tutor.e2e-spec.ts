import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import type { MeResponseDto } from '../src/auth/dto/auth.dto.js';
import { FakeMailSender } from '../src/notifications/fake-mail-sender.js';
import { MailSender } from '../src/notifications/mail-sender.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import type { TutorConversationDto } from '../src/tutor/dto/tutor.dto.js';
import { MESSAGES_PER_PAGE, dayOf } from '../src/tutor/tutor.service.js';
import type { UsageResponseDto } from '../src/worlds/dto/worlds.dto.js';

const WEB_ORIGIN = 'http://localhost:3003';
const PASSWORD = 'correct horse battery';
const DOMAIN = '@tutor.example.com';

let next = 0;
const freshEmail = () => `learner${++next}.${Date.now()}${DOMAIN}`;

/**
 * The learner's one conversation (US-070 criterion 4, US-073) and what is left of
 * today (US-080). Sending a message arrives with the streaming endpoint.
 */
// Requires PostgreSQL.
describe('The tutor conversation (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
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
    rateLimits = app.get<{ storage: Map<string, unknown> }>(
      ThrottlerStorage,
    ).storage;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
    await app.close();
  });

  beforeEach(() => {
    rateLimits.clear();
  });

  async function learner() {
    const agent = request.agent(app.getHttpServer());
    const response = await agent
      .post('/v1/auth/sign-up')
      .set('Origin', WEB_ORIGIN)
      .send({
        email: freshEmail(),
        password: PASSWORD,
        name: 'นก',
        birthYear: adultYear,
        acceptTerms: true,
      })
      .expect(201);

    const id = (response.body as MeResponseDto).id;
    await prisma.user.update({ where: { id }, data: { emailVerified: true } });
    return { agent, id };
  }

  /** Writes a conversation straight to the database, as sending one will. */
  async function said(learnerId: string, count: number) {
    for (let i = 0; i < count; i += 1) {
      await prisma.tutorMessage.create({
        data: {
          learnerId,
          role: i % 2 === 0 ? 'LEARNER' : 'TUTOR',
          content: `message ${i}`,
          // Spaced out, so "newest first" has something to order by.
          createdAt: new Date(Date.now() - (count - i) * 1000),
        },
      });
    }
  }

  const conversation = async (agent: request.Agent, before?: string) =>
    (
      await agent
        .get(`/v1/tutor/messages${before ? `?before=${before}` : ''}`)
        .expect(200)
    ).body as TutorConversationDto;

  describe('reading it (FR-070)', () => {
    it('is empty for a learner who has never asked anything', async () => {
      const { agent } = await learner();

      expect(await conversation(agent)).toEqual({
        messages: [],
        nextCursor: null,
      });
    });

    it('gives the newest messages first', async () => {
      const { agent, id } = await learner();
      await said(id, 3);

      const page = await conversation(agent);

      expect(page.messages.map((m) => m.content)).toEqual([
        'message 2',
        'message 1',
        'message 0',
      ]);
      expect(page.messages[0].role).toBe('LEARNER');
      expect(page.nextCursor).toBeNull();
    });

    /* A long conversation is read a page at a time, newest page first. */
    it('hands back older messages a page at a time', async () => {
      const { agent, id } = await learner();
      await said(id, MESSAGES_PER_PAGE + 5);

      const first = await conversation(agent);
      expect(first.messages).toHaveLength(MESSAGES_PER_PAGE);
      expect(first.nextCursor).not.toBeNull();

      const older = await conversation(agent, first.nextCursor!);
      expect(older.messages).toHaveLength(5);
      expect(older.nextCursor).toBeNull();
      // No message appears on both pages.
      const ids = new Set(first.messages.map((m) => m.id));
      expect(older.messages.some((m) => ids.has(m.id))).toBe(false);
    });

    /* V6: one conversation per learner, and it is nobody else's business. */
    it('shows a learner nothing of anyone else’s', async () => {
      const mine = await learner();
      const theirs = await learner();
      await said(theirs.id, 2);

      expect((await conversation(mine.agent)).messages).toEqual([]);
    });
  });

  describe('clearing it (FR-076, US-073)', () => {
    it('deletes the conversation', async () => {
      const { agent, id } = await learner();
      await said(id, 4);

      await agent
        .delete('/v1/tutor/messages')
        .set('Origin', WEB_ORIGIN)
        .expect(204);

      expect((await conversation(agent)).messages).toEqual([]);
      expect(
        await prisma.tutorMessage.count({ where: { learnerId: id } }),
      ).toBe(0);
    });

    /*
     * US-073 criterion 2. The messages were sent; forgetting them does not
     * unsend them, so clearing must not hand back the day's allowance.
     */
    it('does not give today’s messages back', async () => {
      const { agent, id } = await learner();
      await prisma.tutorDailyUsage.create({
        data: { learnerId: id, day: dayOf(new Date()), messagesUsed: 7 },
      });

      await agent
        .delete('/v1/tutor/messages')
        .set('Origin', WEB_ORIGIN)
        .expect(204);

      const usage = (await agent.get('/v1/me/usage').expect(200))
        .body as UsageResponseDto;
      expect(usage.messagesLeft).toBe(usage.messagesLimit - 7);
    });

    it('clears nobody else’s conversation', async () => {
      const mine = await learner();
      const theirs = await learner();
      await said(theirs.id, 3);

      await mine.agent
        .delete('/v1/tutor/messages')
        .set('Origin', WEB_ORIGIN)
        .expect(204);

      expect(
        await prisma.tutorMessage.count({ where: { learnerId: theirs.id } }),
      ).toBe(3);
    });
  });

  /* US-080 criterion 1: both of the day's limits, not just the photo one. */
  describe('what is left of today (FR-080)', () => {
    it('reports the tutor messages as well as the analyses', async () => {
      const { agent } = await learner();

      const usage = (await agent.get('/v1/me/usage').expect(200))
        .body as UsageResponseDto;

      expect(usage.messagesLimit).toBeGreaterThan(0);
      expect(usage.messagesLeft).toBe(usage.messagesLimit);
      expect(usage.analysesLeft).toBe(usage.analysesLimit);
      // Both counts start again at the same Bangkok midnight (V1).
      expect(usage.resetsAt).toMatch(/T17:00:00/);
    });

    it('counts down as messages are used', async () => {
      const { agent, id } = await learner();
      await prisma.tutorDailyUsage.create({
        data: { learnerId: id, day: dayOf(new Date()), messagesUsed: 4 },
      });

      const usage = (await agent.get('/v1/me/usage').expect(200))
        .body as UsageResponseDto;

      expect(usage.messagesLeft).toBe(usage.messagesLimit - 4);
    });

    /* Yesterday's messages are yesterday's problem (V1). */
    it('ignores a count from another day', async () => {
      const { agent, id } = await learner();
      const yesterday = new Date(dayOf(new Date()).getTime() - 86_400_000);
      await prisma.tutorDailyUsage.create({
        data: { learnerId: id, day: yesterday, messagesUsed: 30 },
      });

      const usage = (await agent.get('/v1/me/usage').expect(200))
        .body as UsageResponseDto;

      expect(usage.messagesLeft).toBe(usage.messagesLimit);
    });
  });

  it('refuses everything to a browser that is not signed in', async () => {
    const server = request(app.getHttpServer());

    await server.get('/v1/tutor/messages').expect(401);
    await server
      .delete('/v1/tutor/messages')
      .set('Origin', WEB_ORIGIN)
      .expect(401);
  });
});
