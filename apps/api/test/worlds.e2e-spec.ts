import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import sharp from 'sharp';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import type { MeResponseDto } from '../src/auth/dto/auth.dto.js';
import { FakeMailSender } from '../src/notifications/fake-mail-sender.js';
import { MailSender } from '../src/notifications/mail-sender.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PhotoStorage } from '../src/storage/photo-storage.js';
import { AnalysisService } from '../src/worlds/analysis.service.js';
import type {
  WorldDetailDto,
  WorldSummaryDto,
} from '../src/worlds/dto/worlds.dto.js';

const WEB_ORIGIN = 'http://localhost:3003';
const PASSWORD = 'correct horse battery';
const DOMAIN = '@worlds.example.com';

let next = 0;
const freshEmail = () => `learner${++next}.${Date.now()}${DOMAIN}`;

const photoOf = (width: number, height: number) =>
  sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 120, g: 160, b: 90 },
    },
  })
    .jpeg()
    .toBuffer();

/*
 * Creating, listing, opening, renaming and deleting worlds (US-010–US-014), against
 * the real database and the real object store: what a learner uploads has to come
 * back as a photo they can see, and disappear when they delete it.
 */
// Requires PostgreSQL and the docker-compose `storage` service.
describe('Worlds (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let storage: PhotoStorage;
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
    rateLimits = app.get<{ storage: Map<string, unknown> }>(
      ThrottlerStorage,
    ).storage;
    photo = await photoOf(3000, 2000);
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

  beforeEach(() => rateLimits.clear());

  /** A signed-in learner whose email address is verified, as world creation needs. */
  async function learner(verified = true) {
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
    if (verified) {
      await prisma.user.update({
        where: { id },
        data: { emailVerified: true },
      });
    }
    return { agent, id };
  }

  const createWorld = (
    agent: request.Agent,
    name = 'ห้องครัว',
    file: Buffer = photo,
  ) =>
    agent
      .post('/v1/worlds')
      .set('Origin', WEB_ORIGIN)
      .field('name', name)
      .attach('photo', file, 'kitchen.jpg');

  describe('creating a world (US-010)', () => {
    it('stores the prepared photo and answers with the world', async () => {
      const { agent } = await learner();

      const response = await createWorld(agent).expect(202);

      const world = response.body as WorldDetailDto;
      expect(world.name).toBe('ห้องครัว');
      // The words come from a background analysis, so the answer comes first (FR-021).
      expect(world.status).toBe('ANALYZING');
      expect(world.photoUrl).toContain('X-Amz-Signature');
      expect(world.thumbnailUrl).toContain('X-Amz-Signature');
    });

    /** FR-017, V18: the stored photo is the prepared one, not what was uploaded. */
    it('stores a photo of at most 2,048 pixels', async () => {
      const { agent, id } = await learner();

      await createWorld(agent).expect(202);

      const stored = await prisma.storedPhoto.findMany({
        where: { ownerId: id },
        orderBy: { kind: 'asc' },
      });
      const prepared = stored.find((p) => p.kind === 'PREPARED');
      expect(prepared?.width).toBe(2048);
      expect(prepared?.contentType).toBe('image/jpeg');
      expect(stored.find((p) => p.kind === 'THUMBNAIL')?.width).toBe(320);
    });

    it('serves the photo through the signed link', async () => {
      const { agent } = await learner();
      const response = await createWorld(agent).expect(202);

      const photoResponse = await fetch(
        (response.body as WorldDetailDto).photoUrl as string,
      );

      expect(photoResponse.status).toBe(200);
      expect(photoResponse.headers.get('content-type')).toBe('image/jpeg');
    });

    it('refuses a file that is not a photo (FR-011)', async () => {
      const { agent, id } = await learner();

      const response = await createWorld(
        agent,
        'ห้องครัว',
        Buffer.from('not a photo at all'),
      ).expect(415);

      expect(response.body).toMatchObject({
        error: { code: 'PHOTO_TYPE_NOT_ALLOWED' },
      });
      expect(await prisma.world.count({ where: { learnerId: id } })).toBe(0);
    });

    it('refuses a photo over 10 MB (FR-011)', async () => {
      const { agent } = await learner();
      const tooLarge = Buffer.alloc(11 * 1024 * 1024, 1);

      const response = await createWorld(agent, 'ใหญ่ไป', tooLarge).expect(413);

      expect(response.body).toMatchObject({
        error: { code: 'PHOTO_TOO_LARGE' },
      });
    });

    it.each([
      ['an empty name', ''],
      ['a name over 50 characters', 'ก'.repeat(51)],
    ])('refuses %s (V3)', async (_case, name) => {
      const { agent } = await learner();

      await createWorld(agent, name).expect(400);
    });

    it('refuses to analyse for an unverified account (FR-006)', async () => {
      const { agent } = await learner(false);

      const response = await createWorld(agent).expect(403);

      expect(response.body).toMatchObject({ error: { code: 'NOT_VERIFIED' } });
    });

    it('refuses the twenty-first world (FR-012)', async () => {
      const { agent, id } = await learner();
      await prisma.world.createMany({
        data: Array.from({ length: 20 }, (_, index) => ({
          learnerId: id,
          name: `โลกที่ ${index + 1}`,
          status: 'READY' as const,
        })),
      });

      const response = await createWorld(agent).expect(409);

      expect(response.body).toMatchObject({
        error: { code: 'WORLD_LIMIT_REACHED' },
      });
    });
  });

  describe('the list and one world (US-011, US-012)', () => {
    it('lists the learner’s worlds, newest first', async () => {
      const { agent } = await learner();
      const older = (await createWorld(agent, 'ห้องครัว').expect(202))
        .body as WorldDetailDto;
      const newer = (await createWorld(agent, 'โต๊ะทำงาน').expect(202))
        .body as WorldDetailDto;
      /*
       * Both analyses are waited for, so the list is read in a settled state.
       * Reading it in between asserted that a fresh world had no words yet, which
       * is a claim about timing rather than about listing: the fake provider
       * answers at once, so sometimes the words were already there.
       */
      await app.get(AnalysisService).settled(older.id);
      await app.get(AnalysisService).settled(newer.id);

      const response = await agent.get('/v1/worlds').expect(200);

      const worlds = response.body as WorldSummaryDto[];
      expect(worlds.map((world) => world.name)).toEqual([
        'โต๊ะทำงาน',
        'ห้องครัว',
      ]);
      expect(worlds[0].thumbnailUrl).toContain('X-Amz-Signature');
      // Once an analysis has finished, the list reports what it found (FR-013).
      expect(worlds[0].wordCount).toBeGreaterThan(0);
      expect(worlds[0].masteredCount).toBe(0);
    });

    it('shows a learner nothing but their own worlds', async () => {
      const mine = await learner();
      const theirs = await learner();
      const world = (await createWorld(theirs.agent).expect(202))
        .body as WorldDetailDto;

      await mine.agent.get(`/v1/worlds/${world.id}`).expect(404);
      await mine.agent
        .patch(`/v1/worlds/${world.id}`)
        .send({ name: 'ของฉัน' })
        .set('Origin', WEB_ORIGIN)
        .expect(404);
      await mine.agent
        .delete(`/v1/worlds/${world.id}`)
        .set('Origin', WEB_ORIGIN)
        .expect(404);
      expect((await mine.agent.get('/v1/worlds').expect(200)).body).toEqual([]);
    });

    it('answers the status on its own, for the page that waits (FR-021)', async () => {
      const { agent } = await learner();
      const world = (await createWorld(agent).expect(202))
        .body as WorldDetailDto;

      const waiting = await agent
        .get(`/v1/worlds/${world.id}/status`)
        .expect(200);
      expect(waiting.body).toEqual({
        status: 'ANALYZING',
        failureReason: null,
      });

      await app.get(AnalysisService).settled(world.id);
      const done = await agent.get(`/v1/worlds/${world.id}/status`).expect(200);
      expect(done.body).toEqual({ status: 'READY', failureReason: null });
    });

    it('refuses a world id that is not an id at all', async () => {
      const { agent } = await learner();

      await agent.get('/v1/worlds/not-a-uuid').expect(400);
    });
  });

  describe('renaming (US-013)', () => {
    it('changes the name', async () => {
      const { agent } = await learner();
      const world = (await createWorld(agent).expect(202))
        .body as WorldDetailDto;

      const response = await agent
        .patch(`/v1/worlds/${world.id}`)
        .set('Origin', WEB_ORIGIN)
        .send({ name: 'ห้องครัวของแม่' })
        .expect(200);

      expect((response.body as WorldDetailDto).name).toBe('ห้องครัวของแม่');
    });

    it('keeps the old name when the new one breaks the rule', async () => {
      const { agent } = await learner();
      const world = (await createWorld(agent).expect(202))
        .body as WorldDetailDto;

      await agent
        .patch(`/v1/worlds/${world.id}`)
        .set('Origin', WEB_ORIGIN)
        .send({ name: '' })
        .expect(400);

      const after = await agent.get(`/v1/worlds/${world.id}`).expect(200);
      expect((after.body as WorldDetailDto).name).toBe('ห้องครัว');
    });
  });

  describe('deleting (US-014)', () => {
    it('removes the world and leaves its photos for cleanup', async () => {
      const { agent, id } = await learner();
      const world = (await createWorld(agent).expect(202))
        .body as WorldDetailDto;
      const keys = (
        await prisma.storedPhoto.findMany({
          where: { ownerId: id },
          select: { storageKey: true },
        })
      ).map(({ storageKey }) => storageKey);
      expect(keys).toHaveLength(2);

      await agent
        .delete(`/v1/worlds/${world.id}`)
        .set('Origin', WEB_ORIGIN)
        .expect(204);

      expect(await prisma.world.count({ where: { learnerId: id } })).toBe(0);
      expect(await prisma.storedPhoto.count({ where: { ownerId: id } })).toBe(
        0,
      );
      const cleanup = await prisma.photoDeletion.findMany({
        where: { storageKey: { in: keys } },
      });
      expect(cleanup).toHaveLength(2);
      expect(cleanup.every((row) => row.reason === 'WORLD_DELETED')).toBe(true);
    });

    /*
     * US-014 criterion 3, FR-015. A word exists because a photo had it in view;
     * once the last photo with it goes, the word goes too, and takes its mastery
     * and mistakes with it. Removing one word at a time already did this — a
     * whole world did not, and left words nothing could reach.
     */
    it('takes the words with it, and their mastery and mistakes', async () => {
      const { agent, id } = await learner();
      const world = (await createWorld(agent).expect(202))
        .body as WorldDetailDto;
      await app.get(AnalysisService).settled(world.id);
      const occurrence = await prisma.wordOccurrence.findFirstOrThrow({
        where: { worldId: world.id },
      });
      await prisma.wordMastery.create({
        data: {
          vocabularyWordId: occurrence.vocabularyWordId,
          learnerId: id,
          level: 'LEARNING',
          lastPractisedAt: new Date(),
        },
      });
      await prisma.attempt.create({
        data: {
          learnerId: id,
          vocabularyWordId: occurrence.vocabularyWordId,
          answerText: 'zzz',
          isCorrect: false,
          levelAfter: 'LEARNING',
        },
      });

      await agent
        .delete(`/v1/worlds/${world.id}`)
        .set('Origin', WEB_ORIGIN)
        .expect(204);

      expect(
        await prisma.vocabularyWord.count({ where: { learnerId: id } }),
      ).toBe(0);
      expect(await prisma.wordMastery.count({ where: { learnerId: id } })).toBe(
        0,
      );
      expect(await prisma.attempt.count({ where: { learnerId: id } })).toBe(0);
    });

    /* US-014 criterion 2: a word in another world of theirs stays, and keeps it. */
    it('keeps a word that another world still has', async () => {
      const { agent, id } = await learner();
      const first = (await createWorld(agent).expect(202))
        .body as WorldDetailDto;
      await app.get(AnalysisService).settled(first.id);
      const second = (await createWorld(agent).expect(202))
        .body as WorldDetailDto;
      await app.get(AnalysisService).settled(second.id);
      const words = await prisma.vocabularyWord.count({
        where: { learnerId: id },
      });
      expect(words).toBeGreaterThan(0);

      await agent
        .delete(`/v1/worlds/${first.id}`)
        .set('Origin', WEB_ORIGIN)
        .expect(204);

      // Both worlds held the same words, so all of them survive in the second.
      expect(
        await prisma.vocabularyWord.count({ where: { learnerId: id } }),
      ).toBe(words);
    });

    it('is gone from the list afterwards', async () => {
      const { agent } = await learner();
      const world = (await createWorld(agent).expect(202))
        .body as WorldDetailDto;

      await agent
        .delete(`/v1/worlds/${world.id}`)
        .set('Origin', WEB_ORIGIN)
        .expect(204);

      expect((await agent.get('/v1/worlds').expect(200)).body).toEqual([]);
      await agent.get(`/v1/worlds/${world.id}`).expect(404);
    });
  });

  it('refuses everything to a browser that is not signed in', async () => {
    const server = request(app.getHttpServer());

    await server.get('/v1/worlds').expect(401);
    await server
      .post('/v1/worlds')
      .set('Origin', WEB_ORIGIN)
      .field('name', 'ห้องครัว')
      .attach('photo', photo, 'kitchen.jpg')
      .expect(401);
  });
});
