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
import { FakeMailSender } from '../src/notifications/fake-mail-sender.js';
import { MailSender } from '../src/notifications/mail-sender.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PhotoStorage } from '../src/storage/photo-storage.js';
import { AnalysisService } from '../src/worlds/analysis.service.js';
import { StaleAnalysisService } from '../src/worlds/stale-analysis.service.js';
import type {
  UsageResponseDto,
  WorldDetailDto,
} from '../src/worlds/dto/worlds.dto.js';

const WEB_ORIGIN = 'http://localhost:3003';
const PASSWORD = 'correct horse battery';
const DOMAIN = '@analysis.example.com';

let next = 0;
const freshEmail = () => `learner${++next}.${Date.now()}${DOMAIN}`;

/*
 * A photo becoming words (US-020), and every way that can end: blocked (US-091),
 * too few words, a provider error, and running out for the day (US-080). The fake
 * provider plays each part (B4), so the pipeline is exercised without a key.
 */
// Requires PostgreSQL and the docker-compose `storage` service.
describe('Analysing a photo (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let storage: PhotoStorage;
  let ai: FakeAiProvider;
  let analysis: AnalysisService;
  let stale: StaleAnalysisService;
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
    ai = app.get<FakeAiProvider>(AiProvider);
    analysis = app.get(AnalysisService);
    stale = app.get(StaleAnalysisService);
    rateLimits = app.get<{ storage: Map<string, unknown> }>(
      ThrottlerStorage,
    ).storage;
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
    ai.behaviour = 'ALLOWED';
    ai.calls.length = 0;
  });

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

    const id = (response.body as MeResponseDto).id;
    await prisma.user.update({ where: { id }, data: { emailVerified: true } });
    return { agent, id };
  }

  /** Creates a world and waits for its analysis, which the fake finishes at once. */
  async function analysedWorld(agent: request.Agent, name = 'ห้องนั่งเล่น') {
    const response = await agent
      .post('/v1/worlds')
      .set('Origin', WEB_ORIGIN)
      .field('name', name)
      .attach('photo', photo, 'room.jpg')
      .expect(202);

    const { id } = response.body as WorldDetailDto;
    await analysis.settled(id);
    // The creation answer is sent before the analysis runs, so the world is read
    // again here: that is where the words are.
    return worldNow(agent, id);
  }

  const worldNow = async (agent: request.Agent, worldId: string) =>
    (await agent.get(`/v1/worlds/${worldId}`).expect(200))
      .body as WorldDetailDto;

  describe('a photo that becomes words (US-020)', () => {
    it('answers while the analysis is still to come (FR-021)', async () => {
      const { agent } = await learner();

      const response = await agent
        .post('/v1/worlds')
        .set('Origin', WEB_ORIGIN)
        .field('name', 'ห้องครัว')
        .attach('photo', photo, 'kitchen.jpg')
        .expect(202);

      expect((response.body as WorldDetailDto).status).toBe('ANALYZING');
      await analysis.settled((response.body as WorldDetailDto).id);
    });

    it('saves the words with their boxes and becomes READY', async () => {
      const { agent } = await learner();

      const created = await analysedWorld(agent);
      const world = await worldNow(agent, created.id);

      expect(world.status).toBe('READY');
      expect(world.words.length).toBeGreaterThanOrEqual(3);
      expect(world.words[0]).toMatchObject({
        english: 'sofa',
        thaiMeaning: 'โซฟา',
        cefrLevel: 'A1',
      });
      expect(world.words[0].box.width).toBeGreaterThan(0);
      expect(world.wordCount).toBe(world.words.length);
    });

    /* The safety check comes first, and only then the extraction (FR-092). */
    it('checks the photo before describing it', async () => {
      const { agent } = await learner();

      await analysedWorld(agent);

      expect(ai.calls.map((call) => call.purpose)).toEqual([
        'SAFETY_CHECK',
        'EXTRACTION',
      ]);
    });

    it('sends the prepared photo, not the upload', async () => {
      const { agent } = await learner();

      await analysedWorld(agent);

      // Preparation shrinks and re-encodes, so the bytes differ from the upload.
      expect(ai.calls[0].bytes).toBeGreaterThan(0);
      expect(ai.calls[0].bytes).not.toBe(photo.byteLength);
    });

    it('records what each call cost, with nothing about the learner', async () => {
      const { agent } = await learner();
      const before = await prisma.aiCall.count();

      await analysedWorld(agent);

      expect(await prisma.aiCall.count()).toBeGreaterThan(before);
    });

    it('keeps one word per learner across worlds', async () => {
      const { agent, id } = await learner();

      await analysedWorld(agent, 'ห้องแรก');
      await analysedWorld(agent, 'ห้องสอง');

      const words = await prisma.vocabularyWord.count({
        where: { learnerId: id, english: 'sofa' },
      });
      expect(words).toBe(1);
      expect(
        await prisma.wordOccurrence.count({
          where: { vocabularyWord: { learnerId: id, english: 'sofa' } },
        }),
      ).toBe(2);
    });
  });

  describe('a photo that breaks the rules (US-091)', () => {
    it('deletes the photo, records the block, and fails the world', async () => {
      const { agent, id } = await learner();
      ai.behaviour = 'BLOCKED';

      const created = await analysedWorld(agent);
      const world = await worldNow(agent, created.id);

      expect(world.status).toBe('FAILED');
      expect(world.failureReason).toBe('BLOCKED');
      expect(world.photoUrl).toBeNull();
      expect(await prisma.storedPhoto.count({ where: { ownerId: id } })).toBe(
        0,
      );
      const block = await prisma.photoBlock.findFirstOrThrow({
        where: { learnerId: id },
      });
      expect(block.category).toBe('VIOLENCE');
    });

    it('never asks for words about a blocked photo (FR-092)', async () => {
      const { agent } = await learner();
      ai.behaviour = 'BLOCKED';

      await analysedWorld(agent);

      expect(ai.calls.map((call) => call.purpose)).toEqual(['SAFETY_CHECK']);
    });

    /* FR-093: a blocked photo is the learner's doing, so it uses one of the ten. */
    it('counts toward the daily limit', async () => {
      const { agent } = await learner();
      ai.behaviour = 'BLOCKED';

      await analysedWorld(agent);

      const usage = (await agent.get('/v1/me/usage').expect(200))
        .body as UsageResponseDto;
      expect(usage.analysesLeft).toBe(usage.analysesLimit - 1);
    });

    it('cannot be retried, because the photo is gone (FR-025)', async () => {
      const { agent } = await learner();
      ai.behaviour = 'BLOCKED';
      const world = await analysedWorld(agent);

      const response = await agent
        .post(`/v1/worlds/${world.id}/retry`)
        .set('Origin', WEB_ORIGIN)
        .expect(409);

      expect(response.body).toMatchObject({
        error: { code: 'RETRY_NOT_AVAILABLE' },
      });
    });
  });

  describe('an analysis that fails (US-021)', () => {
    it.each([
      ['PROVIDER_ERROR', 'PROVIDER_ERROR'],
      ['TIMED_OUT', 'TIMED_OUT'],
      ['TOO_FEW_WORDS', 'TOO_FEW_WORDS'],
      ['INVALID_OUTPUT', 'INVALID_OUTPUT'],
    ] as const)('fails as %s and is not counted', async (behaviour, reason) => {
      const { agent } = await learner();
      ai.behaviour = behaviour;

      const created = await analysedWorld(agent);
      const world = await worldNow(agent, created.id);

      expect(world.status).toBe('FAILED');
      expect(world.failureReason).toBe(reason);
      const usage = (await agent.get('/v1/me/usage').expect(200))
        .body as UsageResponseDto;
      // Released: LanguZe's fault, so the learner keeps their ten (FR-025).
      expect(usage.analysesLeft).toBe(usage.analysesLimit);
    });

    it('keeps the photo so the learner can try again', async () => {
      const { agent } = await learner();
      ai.behaviour = 'PROVIDER_ERROR';

      const created = await analysedWorld(agent);
      const world = await worldNow(agent, created.id);

      expect(world.photoUrl).toContain('X-Amz-Signature');
    });

    it('succeeds on a retry that goes well', async () => {
      const { agent } = await learner();
      ai.behaviour = 'PROVIDER_ERROR';
      const created = await analysedWorld(agent);
      ai.behaviour = 'ALLOWED';

      await agent
        .post(`/v1/worlds/${created.id}/retry`)
        .set('Origin', WEB_ORIGIN)
        .expect(202);
      await analysis.settled(created.id);

      const world = await worldNow(agent, created.id);
      expect(world.status).toBe('READY');
      expect(world.words.length).toBeGreaterThanOrEqual(3);
    });

    it('refuses to retry a world that is not failed', async () => {
      const { agent } = await learner();
      const world = await analysedWorld(agent);

      await agent
        .post(`/v1/worlds/${world.id}/retry`)
        .set('Origin', WEB_ORIGIN)
        .expect(409);
    });
  });

  describe('the daily limit (FR-020, US-080)', () => {
    it('counts an analysis still running as used (U2)', async () => {
      const { agent, id } = await learner();
      await prisma.analysis.create({
        data: { learnerId: id, status: 'IN_PROGRESS' },
      });

      const usage = (await agent.get('/v1/me/usage').expect(200))
        .body as UsageResponseDto;

      expect(usage.analysesLeft).toBe(usage.analysesLimit - 1);
    });

    it('refuses a new world once today is used up, and stores nothing', async () => {
      const { agent, id } = await learner();
      const { analysesLimit } = (await agent.get('/v1/me/usage').expect(200))
        .body as UsageResponseDto;
      await prisma.analysis.createMany({
        data: Array.from({ length: analysesLimit }, () => ({
          learnerId: id,
          status: 'SUCCEEDED' as const,
        })),
      });

      const response = await agent
        .post('/v1/worlds')
        .set('Origin', WEB_ORIGIN)
        .field('name', 'เกินโควตา')
        .attach('photo', photo, 'room.jpg')
        .expect(429);

      expect(response.body).toMatchObject({
        error: { code: 'DAILY_ANALYSIS_LIMIT' },
      });
      expect(await prisma.world.count({ where: { learnerId: id } })).toBe(0);
      expect(await prisma.storedPhoto.count({ where: { ownerId: id } })).toBe(
        0,
      );
    });

    it('says when the count starts again', async () => {
      const { agent } = await learner();

      const usage = (await agent.get('/v1/me/usage').expect(200))
        .body as UsageResponseDto;

      // Midnight in Bangkok is 17:00 UTC.
      expect(new Date(usage.resetsAt).getUTCHours()).toBe(17);
    });
  });

  describe('an analysis that never finished (V16)', () => {
    it('is released after five minutes, with its world', async () => {
      const { agent, id } = await learner();
      const world = await analysedWorld(agent);
      await prisma.world.update({
        where: { id: world.id },
        data: { status: 'ANALYZING', failureReason: null },
      });
      const lost = await prisma.analysis.create({
        data: {
          learnerId: id,
          worldId: world.id,
          status: 'IN_PROGRESS',
          startedAt: new Date(Date.now() - 6 * 60_000),
        },
      });

      expect(await stale.release(new Date())).toBeGreaterThanOrEqual(1);

      expect(
        (await prisma.analysis.findUniqueOrThrow({ where: { id: lost.id } }))
          .status,
      ).toBe('FAILED');
      const after = await worldNow(agent, world.id);
      expect(after.status).toBe('FAILED');
      expect(after.failureReason).toBe('TIMED_OUT');
    });

    it('leaves a young analysis alone', async () => {
      const { agent, id } = await learner();
      const world = await analysedWorld(agent);
      const young = await prisma.analysis.create({
        data: { learnerId: id, worldId: world.id, status: 'IN_PROGRESS' },
      });

      await stale.release(new Date());

      expect(
        (await prisma.analysis.findUniqueOrThrow({ where: { id: young.id } }))
          .status,
      ).toBe('IN_PROGRESS');
    });
  });

  describe('removing a word (US-022)', () => {
    it('removes it from the world', async () => {
      const { agent } = await learner();
      const world = await analysedWorld(agent);
      const [first] = world.words;

      await agent
        .delete(`/v1/worlds/${world.id}/words/${first.id}`)
        .set('Origin', WEB_ORIGIN)
        .expect(204);

      const after = await worldNow(agent, world.id);
      expect(after.words.map((word) => word.id)).not.toContain(first.id);
      expect(after.words).toHaveLength(world.words.length - 1);
    });

    /* FR-027: the word itself survives while another world still has it. */
    it('keeps the word when another world has it too', async () => {
      const { agent, id } = await learner();
      const first = await analysedWorld(agent, 'ห้องแรก');
      await analysedWorld(agent, 'ห้องสอง');
      const sofa = first.words.find((word) => word.english === 'sofa');

      await agent
        .delete(`/v1/worlds/${first.id}/words/${sofa?.id}`)
        .set('Origin', WEB_ORIGIN)
        .expect(204);

      expect(
        await prisma.vocabularyWord.count({
          where: { learnerId: id, english: 'sofa' },
        }),
      ).toBe(1);
    });

    it('deletes the word when that was its last world', async () => {
      const { agent, id } = await learner();
      const world = await analysedWorld(agent);
      const sofa = world.words.find((word) => word.english === 'sofa');

      await agent
        .delete(`/v1/worlds/${world.id}/words/${sofa?.id}`)
        .set('Origin', WEB_ORIGIN)
        .expect(204);

      expect(
        await prisma.vocabularyWord.count({
          where: { learnerId: id, english: 'sofa' },
        }),
      ).toBe(0);
    });

    /* V5: a world with no words is nothing to practise. */
    it('refuses to remove the last word', async () => {
      const { agent } = await learner();
      const world = await analysedWorld(agent);
      for (const word of world.words.slice(0, -1)) {
        await agent
          .delete(`/v1/worlds/${world.id}/words/${word.id}`)
          .set('Origin', WEB_ORIGIN)
          .expect(204);
      }

      const response = await agent
        .delete(`/v1/worlds/${world.id}/words/${world.words.at(-1)?.id}`)
        .set('Origin', WEB_ORIGIN)
        .expect(409);

      expect(response.body).toMatchObject({ error: { code: 'LAST_WORD' } });
    });

    it('refuses to touch another learner’s world', async () => {
      const mine = await learner();
      const theirs = await learner();
      const world = await analysedWorld(theirs.agent);

      await mine.agent
        .delete(`/v1/worlds/${world.id}/words/${world.words[0].id}`)
        .set('Origin', WEB_ORIGIN)
        .expect(404);
    });
  });
});
