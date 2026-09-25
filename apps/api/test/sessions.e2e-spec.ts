import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import sharp from 'sharp';
import request from 'supertest';
import { AiProvider } from '../src/ai/ai-provider.js';
import { FakeAiProvider } from '../src/ai/fake-ai-provider.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import type { MeResponseDto } from '../src/auth/dto/auth.dto.js';
import type { SessionDto } from '../src/learning/dto/sessions.dto.js';
import { SESSION_OPEN_MS } from '../src/learning/sessions.service.js';
import { FakeMailSender } from '../src/notifications/fake-mail-sender.js';
import { MailSender } from '../src/notifications/mail-sender.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PhotoStorage } from '../src/storage/photo-storage.js';
import { AnalysisService } from '../src/worlds/analysis.service.js';
import type { WorldDetailDto } from '../src/worlds/dto/worlds.dto.js';

const WEB_ORIGIN = 'http://localhost:3003';
const PASSWORD = 'correct horse battery';
const DOMAIN = '@sessions.example.com';

let next = 0;
const freshEmail = () => `learner${++next}.${Date.now()}${DOMAIN}`;

/*
 * Starting a game and finding the way back into one (US-030, US-034). Answering
 * arrives with the attempts half of the module; nothing here records an answer.
 */
// Requires PostgreSQL and the docker-compose `storage` service.
describe('Practice sessions (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let storage: PhotoStorage;
  let analysis: AnalysisService;
  let rateLimits: Map<string, unknown>;
  let photo: Buffer;
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
    storage = app.get(PhotoStorage);
    analysis = app.get(AnalysisService);
    rateLimits = app.get<{ storage: Map<string, unknown> }>(
      ThrottlerStorage,
    ).storage;
    app.get<FakeAiProvider>(AiProvider).behaviour = 'ALLOWED';
    photo = await sharp({
      create: {
        width: 900,
        height: 600,
        channels: 3,
        background: { r: 140, g: 110, b: 80 },
      },
    })
      .jpeg()
      .toBuffer();
  });

  afterAll(async () => {
    const learners = await prisma.user.findMany({
      where: { email: { endsWith: DOMAIN } },
      select: { id: true },
    });
    const ids = learners.map(({ id }) => id);
    const photos = await prisma.storedPhoto.findMany({
      where: { ownerId: { in: ids } },
      select: { storageKey: true },
    });
    await Promise.all(
      photos.map(({ storageKey }) =>
        storage.remove(storageKey).catch(() => {}),
      ),
    );
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.photoDeletion.deleteMany({
      where: { storageKey: { in: photos.map((p) => p.storageKey) } },
    });
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

  /** A world with words, which is what a game needs (FR-030). */
  async function playableWorld(agent: request.Agent) {
    const created = await agent
      .post('/v1/worlds')
      .set('Origin', WEB_ORIGIN)
      .field('name', 'ห้องนั่งเล่น')
      .attach('photo', photo, 'room.jpg')
      .expect(202);

    const { id } = created.body as WorldDetailDto;
    await analysis.settled(id);
    return (await agent.get(`/v1/worlds/${id}`).expect(200))
      .body as WorldDetailDto;
  }

  const startGame = (agent: request.Agent, worldId: string, expect_ = 201) =>
    agent
      .post('/v1/sessions')
      .set('Origin', WEB_ORIGIN)
      .send({ kind: 'GAME', worldId })
      .expect(expect_);

  describe('starting a game (US-030)', () => {
    it('asks about the world’s words, and shows where to look', async () => {
      const { agent } = await learner();
      const world = await playableWorld(agent);

      const session = (await startGame(agent, world.id)).body as SessionDto;

      expect(session.status).toBe('IN_PROGRESS');
      expect(session.worldId).toBe(world.id);
      expect(session.questionCount).toBe(world.words.length);
      expect(session.answeredCount).toBe(0);
      expect(session.nextQuestion?.position).toBe(1);
      expect(session.nextQuestion?.photoUrl).toContain('http');
      // The box is one of the world's, so the learner is shown a real object.
      expect(world.words.map((word) => word.box)).toContainEqual(
        session.nextQuestion?.box,
      );
    });

    /*
     * S5, FR-032: an answer that travels to the browser before the learner answers
     * is not an answer. This is the whole point of checking on the server.
     */
    it('sends no word, meaning, or variant with the question', async () => {
      const { agent } = await learner();
      const world = await playableWorld(agent);

      const response = await startGame(agent, world.id);

      const sent = JSON.stringify(response.body);
      for (const word of world.words) {
        expect(sent).not.toContain(word.english);
        expect(sent).not.toContain(word.thaiMeaning);
        expect(sent).not.toContain(word.exampleSentence);
      }
    });

    it('asks the least known words first (FR-030)', async () => {
      const { agent, id: learnerId } = await learner();
      const world = await playableWorld(agent);
      // One word is already mastered, so it must be asked last.
      const mastered = world.words[0];
      const occurrence = await prisma.wordOccurrence.findUniqueOrThrow({
        where: { id: mastered.id },
      });
      await prisma.wordMastery.create({
        data: {
          vocabularyWordId: occurrence.vocabularyWordId,
          learnerId,
          level: 'MASTERED',
          lastPractisedAt: new Date(),
        },
      });

      const session = (await startGame(agent, world.id)).body as SessionDto;

      const questions = await prisma.sessionQuestion.findMany({
        where: { sessionId: session.id },
        orderBy: { position: 'asc' },
      });
      expect(questions.at(-1)?.occurrenceId).toBe(mastered.id);
    });

    it('refuses a world that is still being analysed (FR-030)', async () => {
      const { agent } = await learner();
      const created = await agent
        .post('/v1/worlds')
        .set('Origin', WEB_ORIGIN)
        .field('name', 'ห้องครัว')
        .attach('photo', photo, 'kitchen.jpg')
        .expect(202);
      const { id } = created.body as WorldDetailDto;

      const response = await startGame(agent, id, 409);

      expect(response.body).toMatchObject({
        error: { code: 'WORLD_NOT_READY' },
      });
      await analysis.settled(id);
    });

    /* FR-008: another learner's world is missing, not forbidden. */
    it('refuses a world that is not the learner’s', async () => {
      const owner = await learner();
      const world = await playableWorld(owner.agent);
      const stranger = await learner();

      const response = await startGame(stranger.agent, world.id, 404);

      expect(response.body).toMatchObject({ error: { code: 'NOT_FOUND' } });
    });
  });

  describe('coming back to a session (US-034)', () => {
    it('finds the game still open for the world', async () => {
      const { agent } = await learner();
      const world = await playableWorld(agent);
      const started = (await startGame(agent, world.id)).body as SessionDto;

      const found = await agent
        .get(`/v1/sessions/current?kind=GAME&worldId=${world.id}`)
        .expect(200);

      expect((found.body as SessionDto).id).toBe(started.id);
    });

    /* A query for a kind the API does not have must be refused, not answered. */
    it('refuses a kind it does not serve', async () => {
      const { agent } = await learner();
      const world = await playableWorld(agent);
      await startGame(agent, world.id);

      await agent
        .get(`/v1/sessions/current?kind=PRACTICE&worldId=${world.id}`)
        .expect(400);
    });

    /* And a game must still name its world, even though a review does not. */
    it('refuses to look for a game without a world', async () => {
      const { agent } = await learner();

      await agent.get('/v1/sessions/current?kind=GAME').expect(400);
    });

    it('says there is none when nothing is open', async () => {
      const { agent } = await learner();
      const world = await playableWorld(agent);

      await agent
        .get(`/v1/sessions/current?kind=GAME&worldId=${world.id}`)
        .expect(204);
    });

    /*
     * FR-036: one unfinished game per world. Starting another closes the first
     * without a summary, and the database index would refuse two open at once.
     */
    it('closes the old game when a new one starts', async () => {
      const { agent } = await learner();
      const world = await playableWorld(agent);
      const first = (await startGame(agent, world.id)).body as SessionDto;

      const second = (await startGame(agent, world.id)).body as SessionDto;

      expect(second.id).not.toBe(first.id);
      const before = await agent.get(`/v1/sessions/${first.id}`).expect(200);
      expect((before.body as SessionDto).status).toBe('ABANDONED');
    });

    /* V17: a session left for a day is over, and the learner starts fresh. */
    it('gives up on a session left for a day', async () => {
      const { agent } = await learner();
      const world = await playableWorld(agent);
      const session = (await startGame(agent, world.id)).body as SessionDto;
      await prisma.practiceSession.update({
        where: { id: session.id },
        data: { startedAt: new Date(Date.now() - SESSION_OPEN_MS - 1000) },
      });

      await agent
        .get(`/v1/sessions/current?kind=GAME&worldId=${world.id}`)
        .expect(204);

      const closed = await prisma.practiceSession.findUniqueOrThrow({
        where: { id: session.id },
      });
      expect(closed.status).toBe('ABANDONED');
    });

    it('keeps a session that is only hours old', async () => {
      const { agent } = await learner();
      const world = await playableWorld(agent);
      const session = (await startGame(agent, world.id)).body as SessionDto;
      await prisma.practiceSession.update({
        where: { id: session.id },
        data: { startedAt: new Date(Date.now() - SESSION_OPEN_MS + 60_000) },
      });

      await agent
        .get(`/v1/sessions/current?kind=GAME&worldId=${world.id}`)
        .expect(200);
    });

    /* UC-030 3a: a word the learner removed is not one the game insists on. */
    it('skips a question whose word was removed', async () => {
      const { agent } = await learner();
      const world = await playableWorld(agent);
      const session = (await startGame(agent, world.id)).body as SessionDto;
      const asked = session.nextQuestion?.id;
      const first = await prisma.sessionQuestion.findUniqueOrThrow({
        where: { id: asked },
      });

      await agent
        .delete(`/v1/worlds/${world.id}/words/${first.occurrenceId}`)
        .set('Origin', WEB_ORIGIN)
        .expect(204);

      const second = await prisma.sessionQuestion.findFirstOrThrow({
        where: { sessionId: session.id, position: 2 },
      });
      const after = (await agent.get(`/v1/sessions/${session.id}`).expect(200))
        .body as SessionDto;

      // The next question is the one after it, not nothing and not the same one.
      expect(after.nextQuestion?.id).toBe(second.id);
      expect(after.nextQuestion?.position).toBe(2);
      expect(after.nextQuestion?.id).not.toBe(asked);
      // The question stays in the session; it is passed over, not deleted.
      expect(after.questionCount).toBe(session.questionCount);
    });

    it('refuses a session that is not the learner’s', async () => {
      const owner = await learner();
      const world = await playableWorld(owner.agent);
      const session = (await startGame(owner.agent, world.id))
        .body as SessionDto;
      const stranger = await learner();

      await stranger.agent.get(`/v1/sessions/${session.id}`).expect(404);
    });
  });

  /*
   * Review draws from every world by a rule of its own (US-050, US-051, FR-050).
   * Its answers behave exactly like a game's, which the answering suite covers.
   */
  describe('starting a review (US-050)', () => {
    const startReview = (agent: request.Agent, expect_ = 201) =>
      agent
        .post('/v1/sessions')
        .set('Origin', WEB_ORIGIN)
        .send({ kind: 'REVIEW' })
        .expect(expect_);

    /** Gives a word a mastery level and a history, as answering it would. */
    async function practised(
      learnerId: string,
      occurrenceId: string,
      at: {
        level: 'LEARNING' | 'FAMILIAR' | 'MASTERED';
        practisedAt: Date;
        mistakeAt?: Date;
      },
    ) {
      const occurrence = await prisma.wordOccurrence.findUniqueOrThrow({
        where: { id: occurrenceId },
      });
      await prisma.wordMastery.create({
        data: {
          vocabularyWordId: occurrence.vocabularyWordId,
          learnerId,
          level: at.level,
          lastPractisedAt: at.practisedAt,
        },
      });
      if (at.mistakeAt) {
        await prisma.attempt.create({
          data: {
            learnerId,
            vocabularyWordId: occurrence.vocabularyWordId,
            occurrenceId,
            answerText: 'zzz',
            isCorrect: false,
            levelAfter: at.level,
            answeredAt: at.mistakeAt,
          },
        });
      }
      return occurrence.vocabularyWordId;
    }

    /* US-051 criterion 4: a word never answered is not part of review. */
    it('refuses when nothing has been practised yet (FR-053)', async () => {
      const { agent } = await learner();
      await playableWorld(agent);

      const response = await startReview(agent, 409);

      expect(response.body).toMatchObject({
        error: { code: 'NOTHING_TO_REVIEW' },
      });
    });

    it('asks about the words the learner got wrong, first (FR-050)', async () => {
      const { agent, id } = await learner();
      const world = await playableWorld(agent);
      const [missed, familiar, learning] = world.words;
      await practised(id, familiar.id, {
        level: 'FAMILIAR',
        practisedAt: new Date('2026-09-20T00:00:00Z'),
      });
      await practised(id, learning.id, {
        level: 'LEARNING',
        practisedAt: new Date('2026-09-19T00:00:00Z'),
      });
      const missedWordId = await practised(id, missed.id, {
        level: 'FAMILIAR',
        practisedAt: new Date('2026-09-24T00:00:00Z'),
        mistakeAt: new Date('2026-09-24T00:00:00Z'),
      });

      const session = (await startReview(agent)).body as SessionDto;

      expect(session.kind).toBe('REVIEW');
      // A review belongs to no world, so the page knows not to offer one.
      expect(session.worldId).toBeNull();
      expect(session.questionCount).toBe(3);
      const questions = await prisma.sessionQuestion.findMany({
        where: { sessionId: session.id },
        orderBy: { position: 'asc' },
      });
      expect(questions[0].vocabularyWordId).toBe(missedWordId);
    });

    /*
     * US-050 criterion 4 and FR-050: a mastered word is not brought back, however
     * badly it once went. Without this the query could quietly widen and review
     * would fill up with words the learner already knows.
     */
    it('leaves out a word the learner has mastered', async () => {
      const { agent, id } = await learner();
      const world = await playableWorld(agent);
      await practised(id, world.words[0].id, {
        level: 'MASTERED',
        practisedAt: new Date('2026-09-24T00:00:00Z'),
        mistakeAt: new Date('2026-09-24T00:00:00Z'),
      });
      await practised(id, world.words[1].id, {
        level: 'LEARNING',
        practisedAt: new Date('2026-09-24T00:00:00Z'),
      });

      const session = (await startReview(agent)).body as SessionDto;

      expect(session.questionCount).toBe(1);
      const question = await prisma.sessionQuestion.findFirstOrThrow({
        where: { sessionId: session.id },
      });
      expect(question.occurrenceId).toBe(world.words[1].id);
    });

    /* A review asks about words, not worlds, so it never sends one's answer early. */
    it('sends no word with its questions either (S5)', async () => {
      const { agent, id } = await learner();
      const world = await playableWorld(agent);
      await practised(id, world.words[0].id, {
        level: 'LEARNING',
        practisedAt: new Date('2026-09-24T00:00:00Z'),
      });

      const response = await startReview(agent);

      const sent = JSON.stringify(response.body);
      expect(sent).not.toContain(world.words[0].english);
      expect(sent).not.toContain(world.words[0].thaiMeaning);
    });

    it('finds the review still open, and closes it when a new one starts', async () => {
      const { agent, id } = await learner();
      const world = await playableWorld(agent);
      await practised(id, world.words[0].id, {
        level: 'LEARNING',
        practisedAt: new Date('2026-09-24T00:00:00Z'),
      });
      const first = (await startReview(agent)).body as SessionDto;

      const found = await agent
        .get('/v1/sessions/current?kind=REVIEW')
        .expect(200);
      expect((found.body as SessionDto).id).toBe(first.id);

      const second = (await startReview(agent)).body as SessionDto;
      expect(second.id).not.toBe(first.id);
      const closed = await agent.get(`/v1/sessions/${first.id}`).expect(200);
      expect((closed.body as SessionDto).status).toBe('ABANDONED');
    });

    it('says there is no review open when there is none', async () => {
      const { agent } = await learner();

      await agent.get('/v1/sessions/current?kind=REVIEW').expect(204);
    });

    /* A game still needs its world named; a review must not be asked for one. */
    it('refuses a game with no world', async () => {
      const { agent } = await learner();

      await agent
        .post('/v1/sessions')
        .set('Origin', WEB_ORIGIN)
        .send({ kind: 'GAME' })
        .expect(400);
    });
  });
});
