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
import type { SessionDto } from '../src/learning/dto/sessions.dto.js';
import { FakeMailSender } from '../src/notifications/fake-mail-sender.js';
import { MailSender } from '../src/notifications/mail-sender.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import type { ProgressDto } from '../src/progress/dto/progress.dto.js';
import { PhotoStorage } from '../src/storage/photo-storage.js';
import { AnalysisService } from '../src/worlds/analysis.service.js';
import type { WorldDetailDto } from '../src/worlds/dto/worlds.dto.js';

const WEB_ORIGIN = 'http://localhost:3003';
const PASSWORD = 'correct horse battery';
const DOMAIN = '@progress.example.com';

let next = 0;
const freshEmail = () => `learner${++next}.${Date.now()}${DOMAIN}`;

/** What the learner has to show for their practice (US-060, FR-060, FR-061). */
// Requires PostgreSQL and the docker-compose `storage` service.
describe('Progress (e2e)', () => {
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

  async function playableWorld(agent: request.Agent, name = 'ห้องนั่งเล่น') {
    const created = await agent
      .post('/v1/worlds')
      .set('Origin', WEB_ORIGIN)
      .field('name', name)
      .attach('photo', photo, 'room.jpg')
      .expect(202);

    const { id } = created.body as WorldDetailDto;
    await analysis.settled(id);
    return (await agent.get(`/v1/worlds/${id}`).expect(200))
      .body as WorldDetailDto;
  }

  const progressOf = async (agent: request.Agent) =>
    (await agent.get('/v1/progress').expect(200)).body as ProgressDto;

  it('starts a learner at nothing at all', async () => {
    const { agent } = await learner();

    const progress = await progressOf(agent);

    expect(progress).toEqual({
      totalXp: 0,
      words: { NEW: 0, LEARNING: 0, FAMILIAR: 0, MASTERED: 0 },
      worlds: [],
    });
  });

  /* A word nobody has answered is NEW, and has no row to be counted from. */
  it('counts a world’s words as new before any of them is answered', async () => {
    const { agent } = await learner();
    const world = await playableWorld(agent);

    const progress = await progressOf(agent);

    expect(progress.words.NEW).toBe(world.words.length);
    expect(progress.words.LEARNING).toBe(0);
    expect(progress.worlds).toEqual([
      {
        id: world.id,
        name: world.name,
        wordCount: world.words.length,
        masteredCount: 0,
      },
    ]);
  });

  it('follows the words up as they are answered (FR-061)', async () => {
    const { agent, id } = await learner();
    const world = await playableWorld(agent);
    const [first, second] = world.words;
    for (const [occurrenceId, level] of [
      [first.id, 'LEARNING'],
      [second.id, 'MASTERED'],
    ] as const) {
      const occurrence = await prisma.wordOccurrence.findUniqueOrThrow({
        where: { id: occurrenceId },
      });
      await prisma.wordMastery.create({
        data: {
          vocabularyWordId: occurrence.vocabularyWordId,
          learnerId: id,
          level,
          lastPractisedAt: new Date(),
        },
      });
    }

    const progress = await progressOf(agent);

    expect(progress.words).toEqual({
      NEW: world.words.length - 2,
      LEARNING: 1,
      FAMILIAR: 0,
      MASTERED: 1,
    });
    expect(progress.worlds[0].masteredCount).toBe(1);
  });

  /* FR-060: the XP a game earns is the XP the progress page reports. */
  it('reports the XP the learner actually earned', async () => {
    const { agent } = await learner();
    const world = await playableWorld(agent);
    const session = (
      await agent
        .post('/v1/sessions')
        .set('Origin', WEB_ORIGIN)
        .send({ kind: 'GAME', worldId: world.id })
        .expect(201)
    ).body as SessionDto;
    const questionId = session.nextQuestion!.id;
    const question = await prisma.sessionQuestion.findUniqueOrThrow({
      where: { id: questionId },
      include: { vocabularyWord: true },
    });
    await agent
      .post(`/v1/sessions/${session.id}/questions/${questionId}/answer`)
      .set('Origin', WEB_ORIGIN)
      .send({ answer: question.vocabularyWord!.english })
      .expect(200);

    const progress = await progressOf(agent);

    expect(progress.totalXp).toBe(XP_FOR_CORRECT);
    expect(progress.words.LEARNING).toBe(1);
  });

  /* V4: deleting a world takes its words away, but never the points they earned. */
  it('keeps the XP when the world that earned it is deleted', async () => {
    const { agent, id } = await learner();
    const world = await playableWorld(agent);
    await prisma.learnerXp.create({
      data: { learnerId: id, totalXp: 120 },
    });

    await agent
      .delete(`/v1/worlds/${world.id}`)
      .set('Origin', WEB_ORIGIN)
      .expect(204);

    const progress = await progressOf(agent);
    expect(progress.totalXp).toBe(120);
    expect(progress.worlds).toEqual([]);
    expect(progress.words.NEW).toBe(0);
  });

  it('shows each world, newest first', async () => {
    const { agent } = await learner();
    const older = await playableWorld(agent, 'ห้องครัว');
    const newer = await playableWorld(agent, 'ห้องทำงาน');

    const progress = await progressOf(agent);

    expect(progress.worlds.map((world) => world.id)).toEqual([
      newer.id,
      older.id,
    ]);
  });

  it('refuses a visitor', async () => {
    await request(app.getHttpServer()).get('/v1/progress').expect(401);
  });
});
