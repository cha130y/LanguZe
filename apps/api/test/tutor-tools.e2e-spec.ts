import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import type { TutorTool } from '../src/ai/ai-provider.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import type { MeResponseDto } from '../src/auth/dto/auth.dto.js';
import { FakeMailSender } from '../src/notifications/fake-mail-sender.js';
import { MailSender } from '../src/notifications/mail-sender.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  MOST_ROWS,
  TutorToolsService,
} from '../src/tutor/tutor-tools.service.js';

const WEB_ORIGIN = 'http://localhost:3003';
const DOMAIN = '@tutortools.example.com';

let next = 0;
const freshEmail = () => `learner${++next}.${Date.now()}${DOMAIN}`;

/**
 * What the tutor may look up (US-071, FR-072). These run against the database
 * because the whole point of them is which rows they can reach.
 */
// Requires PostgreSQL.
describe('The tutor tools (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let tools: TutorToolsService;
  let rateLimits: Map<string, unknown>;

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
    tools = app.get(TutorToolsService);
    rateLimits = app.get<{ storage: Map<string, unknown> }>(
      ThrottlerStorage,
    ).storage;
  });

  // This suite makes a learner per test, which sign-up would otherwise rate-limit.
  beforeEach(() => {
    rateLimits.clear();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
    await app.close();
  });

  async function learner() {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/sign-up')
      .set('Origin', WEB_ORIGIN)
      .send({
        email: freshEmail(),
        password: 'correct horse battery',
        name: 'นก',
        birthYear: new Date().getFullYear() - 25,
        acceptTerms: true,
      })
      .expect(201);
    return (response.body as MeResponseDto).id;
  }

  /** A world with one word, and whatever history the test wants on it. */
  async function word(
    learnerId: string,
    english: string,
    at: {
      level?: 'LEARNING' | 'FAMILIAR' | 'MASTERED';
      practisedAt?: Date;
      wrongAnswers?: { text: string | null; at: Date }[];
    } = {},
  ) {
    const world = await prisma.world.create({
      data: { learnerId, name: 'ห้อง', status: 'READY' },
    });
    const vocabularyWord = await prisma.vocabularyWord.create({
      data: {
        learnerId,
        english,
        thaiMeaning: `ความหมายของ ${english}`,
        thaiMeaningKey: `ความหมายของ ${english}`,
      },
    });
    await prisma.wordOccurrence.create({
      data: {
        worldId: world.id,
        vocabularyWordId: vocabularyWord.id,
        boxX: 0.1,
        boxY: 0.1,
        boxWidth: 0.2,
        boxHeight: 0.2,
        exampleSentence: `The ${english} is here.`,
        cefrLevel: 'A1',
        acceptedVariants: [],
      },
    });
    if (at.level) {
      await prisma.wordMastery.create({
        data: {
          vocabularyWordId: vocabularyWord.id,
          learnerId,
          level: at.level,
          lastPractisedAt: at.practisedAt ?? new Date(),
        },
      });
    }
    for (const wrong of at.wrongAnswers ?? []) {
      await prisma.attempt.create({
        data: {
          learnerId,
          vocabularyWordId: vocabularyWord.id,
          answerText: wrong.text,
          isDontKnow: wrong.text === null,
          isCorrect: false,
          levelAfter: at.level ?? 'LEARNING',
          answeredAt: wrong.at,
        },
      });
    }
    return vocabularyWord.id;
  }

  const toolNamed = (learnerId: string, name: string): TutorTool => {
    const tool = tools.forLearner(learnerId).find((t) => t.name === name);
    if (!tool) throw new Error(`no tool named ${name}`);
    return tool;
  };

  /*
   * FR-072. No tool takes a learner identifier, so there is no input the model
   * could write that reaches another learner. This is the whole authorization.
   */
  it('gives the model no way to name a learner', async () => {
    const learnerId = await learner();

    for (const tool of tools.forLearner(learnerId)) {
      const names = tool.parameters.map((parameter) => parameter.name);
      expect(names).not.toContain('learnerId');
      expect(names.join(' ')).not.toMatch(/learner|user|account/i);
    }
  });

  describe('weak words', () => {
    it('gives the words still being learned, and how often they went wrong', async () => {
      const learnerId = await learner();
      await word(learnerId, 'sofa', {
        level: 'LEARNING',
        wrongAnswers: [{ text: 'zzz', at: new Date() }],
      });
      await word(learnerId, 'clock', { level: 'MASTERED' });

      const result = (await toolNamed(learnerId, 'weak_words').run({
        count: 5,
      })) as { words: { english: string; mistakes: number }[] };

      expect(result.words.map((w) => w.english)).toEqual(['sofa']);
      expect(result.words[0].mistakes).toBe(1);
    });

    it('never hands back more rows than it promises', async () => {
      const learnerId = await learner();
      await word(learnerId, 'sofa', { level: 'LEARNING' });

      const result = (await toolNamed(learnerId, 'weak_words').run({
        count: 5000,
      })) as { words: unknown[] };

      expect(result.words.length).toBeLessThanOrEqual(MOST_ROWS);
    });

    /* A model guessing badly at a number is not a reason to refuse an answer. */
    it('copes with a count that makes no sense', async () => {
      const learnerId = await learner();
      await word(learnerId, 'sofa', { level: 'LEARNING' });

      for (const count of [-1, 0, 'many', null, undefined]) {
        const result = (await toolNamed(learnerId, 'weak_words').run({
          count,
        })) as { words: unknown[] };
        expect(result.words).toHaveLength(1);
      }
    });

    it('reads nobody else’s words', async () => {
      const mine = await learner();
      const theirs = await learner();
      await word(theirs, 'sofa', { level: 'LEARNING' });

      const result = (await toolNamed(mine, 'weak_words').run({})) as {
        words: unknown[];
      };

      expect(result.words).toEqual([]);
    });
  });

  describe('recent mistakes', () => {
    /* US-071 criterion 1: the tutor explains from what the learner actually typed. */
    it('keeps what the learner typed, newest first', async () => {
      const learnerId = await learner();
      await word(learnerId, 'sofa', {
        level: 'LEARNING',
        wrongAnswers: [
          { text: 'sofaa', at: new Date('2026-09-24T10:00:00Z') },
          { text: null, at: new Date('2026-09-25T10:00:00Z') },
        ],
      });

      const result = (await toolNamed(learnerId, 'recent_mistakes').run({
        count: 10,
      })) as {
        mistakes: { answered: string | null; saidTheyDidNotKnow: boolean }[];
      };

      expect(result.mistakes).toHaveLength(2);
      // Giving up is reported as itself, not as a wrong answer they typed.
      expect(result.mistakes[0]).toMatchObject({
        answered: null,
        saidTheyDidNotKnow: true,
      });
      expect(result.mistakes[1]).toMatchObject({
        answered: 'sofaa',
        saidTheyDidNotKnow: false,
      });
    });

    /* US-071 criterion 3: with no mistakes, the tutor is told so, not left to guess. */
    it('says plainly that there are none', async () => {
      const learnerId = await learner();

      const result = (await toolNamed(learnerId, 'recent_mistakes').run(
        {},
      )) as { mistakes: unknown[] };

      expect(result.mistakes).toEqual([]);
    });
  });

  describe('word details', () => {
    it('gives one of the learner’s words and how they have answered it', async () => {
      const learnerId = await learner();
      await word(learnerId, 'sofa', {
        level: 'FAMILIAR',
        wrongAnswers: [{ text: 'sofaa', at: new Date() }],
      });

      const result = (await toolNamed(learnerId, 'word_details').run({
        word: 'sofa',
      })) as Record<string, unknown>;

      expect(result).toMatchObject({
        found: true,
        english: 'sofa',
        cefrLevel: 'A1',
        mastery: 'FAMILIAR',
      });
      expect(result.exampleSentence).toBe('The sofa is here.');
    });

    /* SRS 4.2: the model writing "the sofa" still finds the learner's `sofa`. */
    it('finds a word however the model spells the request', async () => {
      const learnerId = await learner();
      await word(learnerId, 'sofa', { level: 'LEARNING' });

      const result = (await toolNamed(learnerId, 'word_details').run({
        word: '  The Sofa ',
      })) as { found: boolean };

      expect(result.found).toBe(true);
    });

    /* FR-075: saying "not yours" is what stops a history being invented for it. */
    it('says a word is not the learner’s rather than inventing one', async () => {
      const mine = await learner();
      const theirs = await learner();
      await word(theirs, 'sofa', { level: 'LEARNING' });

      const result = (await toolNamed(mine, 'word_details').run({
        word: 'sofa',
      })) as { found: boolean; error?: string };

      expect(result.found).toBe(false);
      expect(result.error).toContain('does not have');
    });

    it('refuses an empty request with an explanation, not with data', async () => {
      const learnerId = await learner();

      for (const asked of ['', '   ', 42, null, undefined]) {
        const result = (await toolNamed(learnerId, 'word_details').run({
          word: asked,
        })) as { error?: string; english?: string };
        expect(result.error).toBeDefined();
        expect(result.english).toBeUndefined();
      }
    });
  });
});
