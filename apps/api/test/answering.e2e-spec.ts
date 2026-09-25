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
import { XP_FOR_CORRECT } from '../src/learning/answer-check.js';
import type {
  AnswerResultDto,
  SessionDto,
} from '../src/learning/dto/sessions.dto.js';
import { SESSION_OPEN_MS } from '../src/learning/sessions.service.js';
import { FakeMailSender } from '../src/notifications/fake-mail-sender.js';
import { MailSender } from '../src/notifications/mail-sender.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PhotoStorage } from '../src/storage/photo-storage.js';
import { AnalysisService } from '../src/worlds/analysis.service.js';
import type { WorldDetailDto } from '../src/worlds/dto/worlds.dto.js';

const WEB_ORIGIN = 'http://localhost:3003';
const PASSWORD = 'correct horse battery';
const DOMAIN = '@answering.example.com';

let next = 0;
const freshEmail = () => `learner${++next}.${Date.now()}${DOMAIN}`;

/*
 * Answering: what it records, what it awards, and what it refuses to do twice
 * (US-031, US-032, US-033, US-040, US-042).
 */
// Requires PostgreSQL and the docker-compose `storage` service.
describe('Answering a question (e2e)', () => {
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

  /** A learner with a played-in world and a game already open on it. */
  async function playing() {
    const { agent, id } = await learner();
    const created = await agent
      .post('/v1/worlds')
      .set('Origin', WEB_ORIGIN)
      .field('name', 'ห้องนั่งเล่น')
      .attach('photo', photo, 'room.jpg')
      .expect(202);
    const worldId = (created.body as WorldDetailDto).id;
    await analysis.settled(worldId);
    const world = (await agent.get(`/v1/worlds/${worldId}`).expect(200))
      .body as WorldDetailDto;

    const session = (
      await agent
        .post('/v1/sessions')
        .set('Origin', WEB_ORIGIN)
        .send({ kind: 'GAME', worldId })
        .expect(201)
    ).body as SessionDto;

    return { agent, learnerId: id, world, session };
  }

  /** The English word a question is about, which only the server may know. */
  async function wordOf(questionId: string) {
    const question = await prisma.sessionQuestion.findUniqueOrThrow({
      where: { id: questionId },
      include: { vocabularyWord: true, occurrence: true },
    });
    return {
      english: question.vocabularyWord?.english ?? '',
      variants: question.occurrence?.acceptedVariants ?? [],
    };
  }

  const answer = (
    agent: request.Agent,
    session: SessionDto,
    questionId: string,
    body: Record<string, unknown>,
    status = 200,
  ) =>
    agent
      .post(`/v1/sessions/${session.id}/questions/${questionId}/answer`)
      .set('Origin', WEB_ORIGIN)
      .send(body)
      .expect(status);

  describe('a right answer (US-031)', () => {
    it('says so, teaches the word, and pays the XP', async () => {
      const { agent, learnerId, session } = await playing();
      const questionId = session.nextQuestion!.id;
      const { english } = await wordOf(questionId);

      const result = (
        await answer(agent, session, questionId, { answer: english })
      ).body as AnswerResultDto;

      expect(result).toMatchObject({
        correct: true,
        dontKnow: false,
        alreadyAnswered: false,
        xpAwarded: XP_FOR_CORRECT,
        // A first right answer starts the word off (SRS 4.1).
        mastery: { before: null, after: 'LEARNING' },
        sessionCompleted: false,
      });
      expect(result.word.english).toBe(english);
      expect(result.word.thaiMeaning).not.toBe('');
      expect(result.word.exampleSentence).toContain(' ');

      const xp = await prisma.learnerXp.findUniqueOrThrow({
        where: { learnerId },
      });
      expect(xp.totalXp).toBe(XP_FOR_CORRECT);
    });

    /* SRS 4.2: case, spaces, and one leading article make no difference. */
    it('accepts the word however it is typed', async () => {
      const { agent, session } = await playing();
      const questionId = session.nextQuestion!.id;
      const { english } = await wordOf(questionId);

      const result = (
        await answer(agent, session, questionId, {
          answer: `  THE ${english.toUpperCase()} `,
        })
      ).body as AnswerResultDto;

      expect(result.correct).toBe(true);
    });

    it('accepts an accepted variant', async () => {
      const { agent, session } = await playing();
      // Not every word has one, so the test asks about a word that does.
      const withVariant = await prisma.sessionQuestion.findFirstOrThrow({
        where: {
          sessionId: session.id,
          occurrence: { acceptedVariants: { isEmpty: false } },
        },
        include: { occurrence: true },
      });

      const result = (
        await answer(agent, session, withVariant.id, {
          answer: withVariant.occurrence!.acceptedVariants[0],
        })
      ).body as AnswerResultDto;

      expect(result.correct).toBe(true);
    });
  });

  describe('a wrong answer (US-031, US-042)', () => {
    it('keeps what was typed, pays nothing, and takes nothing away', async () => {
      const { agent, learnerId, session } = await playing();
      const questionId = session.nextQuestion!.id;

      const result = (
        await answer(agent, session, questionId, { answer: 'zzzz' })
      ).body as AnswerResultDto;

      expect(result).toMatchObject({
        correct: false,
        xpAwarded: 0,
        mastery: { before: null, after: 'LEARNING' },
      });
      // The mistake is kept with the learner's own words, for review and the tutor.
      const attempt = await prisma.attempt.findUniqueOrThrow({
        where: { questionId },
      });
      expect(attempt.answerText).toBe('zzzz');
      expect(attempt.isDontKnow).toBe(false);
      expect(
        await prisma.learnerXp.findUnique({ where: { learnerId } }),
      ).toBeNull();
    });

    /* US-032: giving up is an incorrect attempt with nothing typed. */
    it('records "I don’t know" without inventing an answer', async () => {
      const { agent, session } = await playing();
      const questionId = session.nextQuestion!.id;

      const result = (
        await answer(agent, session, questionId, { dontKnow: true })
      ).body as AnswerResultDto;

      expect(result).toMatchObject({
        correct: false,
        dontKnow: true,
        xpAwarded: 0,
      });
      expect(result.word.english).not.toBe('');

      const attempt = await prisma.attempt.findUniqueOrThrow({
        where: { questionId },
      });
      expect(attempt.answerText).toBeNull();
      expect(attempt.isDontKnow).toBe(true);
    });

    /* UC-031 1b: an empty answer is neither an answer nor giving up. */
    it('refuses an empty answer rather than recording a mistake', async () => {
      const { agent, session } = await playing();
      const questionId = session.nextQuestion!.id;

      await answer(agent, session, questionId, { answer: '' }, 400);
      await answer(agent, session, questionId, {}, 400);

      expect(
        await prisma.attempt.findUnique({ where: { questionId } }),
      ).toBeNull();
    });

    it('refuses an answer longer than the limit (V19)', async () => {
      const { agent, session } = await playing();

      await answer(
        agent,
        session,
        session.nextQuestion!.id,
        { answer: 'a'.repeat(101) },
        400,
      );
    });
  });

  describe('one answer per question (FR-034, S5)', () => {
    it('shows the recorded result again and pays no more XP', async () => {
      const { agent, learnerId, session } = await playing();
      const questionId = session.nextQuestion!.id;
      const { english } = await wordOf(questionId);
      await answer(agent, session, questionId, { answer: english });

      const again = (
        await answer(agent, session, questionId, { answer: 'something else' })
      ).body as AnswerResultDto;

      expect(again).toMatchObject({
        alreadyAnswered: true,
        correct: true,
        xpAwarded: 0,
      });
      const xp = await prisma.learnerXp.findUniqueOrThrow({
        where: { learnerId },
      });
      expect(xp.totalXp).toBe(XP_FOR_CORRECT);
      expect(await prisma.attempt.count({ where: { questionId } })).toBe(1);
    });

    /* Two answers at once: the database decides, and only one is recorded. */
    it('records one attempt when two answers arrive together', async () => {
      const { agent, learnerId, session } = await playing();
      const questionId = session.nextQuestion!.id;
      const { english } = await wordOf(questionId);

      const [first, second] = await Promise.all([
        answer(agent, session, questionId, { answer: english }),
        answer(agent, session, questionId, { answer: english }),
      ]);

      const results = [first.body, second.body] as AnswerResultDto[];
      expect(results.filter((r) => r.alreadyAnswered)).toHaveLength(1);
      expect(await prisma.attempt.count({ where: { questionId } })).toBe(1);
      const xp = await prisma.learnerXp.findUniqueOrThrow({
        where: { learnerId },
      });
      expect(xp.totalXp).toBe(XP_FOR_CORRECT);
    });
  });

  describe('mastery follows the answers (US-040, US-041)', () => {
    it('moves the word up, and every world of the learner with it', async () => {
      const { agent, learnerId, session } = await playing();
      const questionId = session.nextQuestion!.id;
      const { english } = await wordOf(questionId);
      const occurrence = await prisma.sessionQuestion.findUniqueOrThrow({
        where: { id: questionId },
        select: { vocabularyWordId: true },
      });

      await answer(agent, session, questionId, { answer: english });

      const mastery = await prisma.wordMastery.findUniqueOrThrow({
        where: { vocabularyWordId: occurrence.vocabularyWordId! },
      });
      expect(mastery).toMatchObject({
        learnerId,
        level: 'LEARNING',
        streak: 1,
      });
    });

    /* SRS 4.1 through the whole stack: two right answers reach FAMILIAR. */
    it('reaches FAMILIAR on the second right answer', async () => {
      const { agent, world } = await playing();
      const firstGame = (
        await agent
          .post('/v1/sessions')
          .set('Origin', WEB_ORIGIN)
          .send({ kind: 'GAME', worldId: world.id })
          .expect(201)
      ).body as SessionDto;
      const questionId = firstGame.nextQuestion!.id;
      const { english } = await wordOf(questionId);
      const wordId = (
        await prisma.sessionQuestion.findUniqueOrThrow({
          where: { id: questionId },
        })
      ).vocabularyWordId!;
      await answer(agent, firstGame, questionId, { answer: english });

      // A second game, and the same word answered right again.
      const secondGame = (
        await agent
          .post('/v1/sessions')
          .set('Origin', WEB_ORIGIN)
          .send({ kind: 'GAME', worldId: world.id })
          .expect(201)
      ).body as SessionDto;
      const again = await prisma.sessionQuestion.findFirstOrThrow({
        where: { sessionId: secondGame.id, vocabularyWordId: wordId },
      });
      const result = (
        await answer(agent, secondGame, again.id, { answer: english })
      ).body as AnswerResultDto;

      expect(result.mastery).toEqual({
        before: 'LEARNING',
        after: 'FAMILIAR',
      });
      const mastery = await prisma.wordMastery.findUniqueOrThrow({
        where: { vocabularyWordId: wordId },
      });
      expect(mastery.streak).toBe(0);
      expect(mastery.familiarOn).not.toBeNull();
    });
  });

  describe('the end of a session (US-033)', () => {
    /** Answers every question of a session, right or wrong as asked. */
    async function playThrough(
      agent: request.Agent,
      session: SessionDto,
      correctly: (index: number) => boolean,
    ) {
      let current = session;
      let last: AnswerResultDto | null = null;
      for (let i = 0; current.nextQuestion; i += 1) {
        const questionId = current.nextQuestion.id;
        const { english } = await wordOf(questionId);
        last = (
          await answer(agent, session, questionId, {
            answer: correctly(i) ? english : 'zzzz',
          })
        ).body as AnswerResultDto;
        current = (await agent.get(`/v1/sessions/${session.id}`).expect(200))
          .body as SessionDto;
      }
      return { last, session: current };
    }

    it('adds up what the learner achieved (FR-035)', async () => {
      const { agent, session } = await playing();

      const { last, session: finished } = await playThrough(
        agent,
        session,
        (i) => i % 2 === 0,
      );

      const correctCount = Math.ceil(session.questionCount / 2);
      expect(last?.sessionCompleted).toBe(true);
      expect(last?.summary).toMatchObject({
        answeredCount: session.questionCount,
        correctCount,
        xpEarned: correctCount * XP_FOR_CORRECT,
      });
      // Every word was NEW and every answer moved it to LEARNING.
      expect(last?.summary?.levelChanges).toHaveLength(session.questionCount);

      expect(finished.status).toBe('COMPLETED');
      expect(finished.nextQuestion).toBeNull();
      expect(finished.summary).toEqual(last?.summary);
    });

    /* FR-036: a session left unfinished has nothing to show for itself. */
    it('gives an abandoned session no summary', async () => {
      const { agent, world, session } = await playing();
      const questionId = session.nextQuestion!.id;
      const { english } = await wordOf(questionId);
      await answer(agent, session, questionId, { answer: english });

      await agent
        .post('/v1/sessions')
        .set('Origin', WEB_ORIGIN)
        .send({ kind: 'GAME', worldId: world.id })
        .expect(201);

      const abandoned = (
        await agent.get(`/v1/sessions/${session.id}`).expect(200)
      ).body as SessionDto;
      expect(abandoned.status).toBe('ABANDONED');
      expect(abandoned.summary).toBeNull();
      // The answer it did record stays recorded (FR-036).
      expect(await prisma.attempt.count({ where: { questionId } })).toBe(1);
    });
  });

  describe('what cannot be answered', () => {
    it('refuses a session that was left for a day (V17)', async () => {
      const { agent, session } = await playing();
      await prisma.practiceSession.update({
        where: { id: session.id },
        data: { startedAt: new Date(Date.now() - SESSION_OPEN_MS - 1000) },
      });

      const response = await answer(
        agent,
        session,
        session.nextQuestion!.id,
        { dontKnow: true },
        409,
      );

      expect(response.body).toMatchObject({
        error: { code: 'SESSION_CLOSED' },
      });
    });

    /* UC-031 2b: the word went away while the session was open. */
    it('refuses a question whose word was removed', async () => {
      const { agent, world, session } = await playing();
      const questionId = session.nextQuestion!.id;
      const question = await prisma.sessionQuestion.findUniqueOrThrow({
        where: { id: questionId },
      });
      await agent
        .delete(`/v1/worlds/${world.id}/words/${question.occurrenceId}`)
        .set('Origin', WEB_ORIGIN)
        .expect(204);

      const response = await answer(
        agent,
        session,
        questionId,
        { dontKnow: true },
        409,
      );

      expect(response.body).toMatchObject({
        error: { code: 'QUESTION_UNAVAILABLE' },
      });
    });

    it('refuses a question in somebody else’s session', async () => {
      const { session } = await playing();
      const stranger = await learner();

      await answer(
        stranger.agent,
        session,
        session.nextQuestion!.id,
        { dontKnow: true },
        404,
      );
    });
  });
});
