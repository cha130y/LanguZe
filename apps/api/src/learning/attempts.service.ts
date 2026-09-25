import { HttpStatus, Injectable } from '@nestjs/common';
import type { MasteryLevel } from '../generated/prisma/enums.js';
import { AppError } from '../platform/errors/app-error.js';
import { ErrorCode } from '../platform/errors/error-codes.js';
import { bangkokDay } from '../platform/time/bangkok-day.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { isCorrectAnswer, xpFor } from './answer-check.js';
import type { AnswerDto, AnswerResultDto } from './dto/sessions.dto.js';
import { nextMastery, type Mastery } from './mastery-rules.js';
import { summaryOf } from './session-summary.js';
import { SESSION_OPEN_MS } from './sessions.service.js';

/** Postgres's code for a broken unique constraint, which Prisma passes through. */
const UNIQUE_VIOLATION = 'P2002';

/**
 * A `date` column holds a day, not an instant: Prisma hands it back as midnight
 * UTC, so the day is read straight off it rather than through a time zone, which
 * would move it (V1).
 */
const dayOf = (date: Date | null): string | null =>
  date ? date.toISOString().slice(0, 10) : null;
const dateOf = (day: string | null): Date | null =>
  day ? new Date(`${day}T00:00:00Z`) : null;

/**
 * Answering a question (FR-032 to FR-034). The attempt, what it did to the word's
 * mastery, and the XP it earned are written together or not at all: a learner who
 * answered and gained nothing, or gained XP for an answer nobody kept, would have
 * no way to tell what had happened (NFR-011).
 */
@Injectable()
export class AttemptsService {
  constructor(private readonly prisma: PrismaService) {}

  async answer(
    learnerId: string,
    sessionId: string,
    questionId: string,
    body: AnswerDto,
  ): Promise<AnswerResultDto> {
    const question = await this.prisma.sessionQuestion.findFirst({
      where: { id: questionId, sessionId, session: { learnerId } },
      include: {
        session: true,
        attempt: true,
        occurrence: true,
        vocabularyWord: { include: { mastery: true } },
      },
    });
    // A question in somebody else's session is missing, not forbidden (FR-008).
    if (!question) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        HttpStatus.NOT_FOUND,
        'This question does not exist.',
      );
    }

    const { occurrence, vocabularyWord: word } = question;
    /*
     * The word was removed, or its world deleted, since the session started. There
     * is nothing left to ask about and nothing to tell the learner (UC-031 2b).
     */
    if (!occurrence || !word) {
      throw new AppError(
        ErrorCode.QUESTION_UNAVAILABLE,
        HttpStatus.CONFLICT,
        'This word is no longer in the world.',
      );
    }

    const feedback = {
      english: word.english,
      thaiMeaning: word.thaiMeaning,
      exampleSentence: occurrence.exampleSentence,
    };

    /*
     * Already answered: the recorded result is shown again and nothing is written,
     * which is what a double submission or a reloaded page must come to (FR-034,
     * S5). This comes before the session's own state, so that answering the last
     * question and then pressing again shows the result rather than an error.
     */
    if (question.attempt) {
      return this.recorded(question.attempt, feedback, sessionId);
    }

    const session = question.session;
    if (
      session.status !== 'IN_PROGRESS' ||
      Date.now() - session.startedAt.getTime() >= SESSION_OPEN_MS
    ) {
      // A session left for a day is over, whatever its row still says (V17).
      await this.prisma.practiceSession.updateMany({
        where: { id: sessionId, status: 'IN_PROGRESS' },
        data: { status: 'ABANDONED' },
      });
      throw new AppError(
        ErrorCode.SESSION_CLOSED,
        HttpStatus.CONFLICT,
        'This session is no longer open.',
      );
    }

    const dontKnow = body.dontKnow === true;
    // Giving up keeps no answer text, which the database also insists on.
    const answerText = dontKnow ? null : (body.answer ?? '');
    const correct =
      !dontKnow &&
      isCorrectAnswer(
        answerText ?? '',
        word.english,
        occurrence.acceptedVariants,
      );

    const before: Mastery | null = word.mastery
      ? {
          level: word.mastery.level,
          streak: word.mastery.streak,
          familiarOn: dayOf(word.mastery.familiarOn),
        }
      : null;
    const now = new Date();
    const after = nextMastery(before, correct, bangkokDay(now));
    const xpAwarded = xpFor(correct);

    try {
      const { completed } = await this.prisma.$transaction(async (tx) => {
        await tx.attempt.create({
          data: {
            learnerId,
            vocabularyWordId: word.id,
            questionId,
            sessionId,
            occurrenceId: occurrence.id,
            answerText,
            isDontKnow: dontKnow,
            isCorrect: correct,
            xpAwarded,
            levelBefore: before?.level ?? null,
            levelAfter: after.level,
            answeredAt: now,
          },
        });

        // One mastery per word, shared by every world that contains it (FR-040).
        await tx.wordMastery.upsert({
          where: { vocabularyWordId: word.id },
          create: {
            vocabularyWordId: word.id,
            learnerId,
            level: after.level,
            streak: after.streak,
            familiarOn: dateOf(after.familiarOn),
            lastPractisedAt: now,
          },
          update: {
            level: after.level,
            streak: after.streak,
            familiarOn: dateOf(after.familiarOn),
            lastPractisedAt: now,
          },
        });

        if (xpAwarded > 0) {
          // Incremented rather than recounted, so XP never falls (FR-060, V4).
          await tx.learnerXp.upsert({
            where: { learnerId },
            create: { learnerId, totalXp: xpAwarded },
            update: { totalXp: { increment: xpAwarded } },
          });
        }

        /*
         * A session ends when nothing is left to ask. Questions whose word was
         * removed do not count: they can never be answered, and a session waiting
         * for them would stay open until it timed out.
         */
        const left = await tx.sessionQuestion.count({
          where: {
            sessionId,
            attempt: { is: null },
            occurrenceId: { not: null },
          },
        });
        if (left === 0) {
          await tx.practiceSession.update({
            where: { id: sessionId },
            data: { status: 'COMPLETED', completedAt: now },
          });
        }
        return { completed: left === 0 };
      });

      return {
        correct,
        dontKnow,
        alreadyAnswered: false,
        word: feedback,
        xpAwarded,
        mastery: { before: before?.level ?? null, after: after.level },
        sessionCompleted: completed,
        summary: completed ? await this.summary(sessionId) : null,
      };
    } catch (error) {
      /*
       * Two answers to one question arrived together and the database refused the
       * second. The first one counts; this shows what it recorded (FR-034).
       */
      if (isUniqueViolation(error)) {
        const attempt = await this.prisma.attempt.findUniqueOrThrow({
          where: { questionId },
        });
        return this.recorded(attempt, feedback, sessionId);
      }
      throw error;
    }
  }

  /** The result of an answer already recorded. Nothing is written. */
  private async recorded(
    attempt: {
      isCorrect: boolean;
      isDontKnow: boolean;
      levelBefore: MasteryLevel | null;
      levelAfter: MasteryLevel;
    },
    word: AnswerResultDto['word'],
    sessionId: string,
  ): Promise<AnswerResultDto> {
    const session = await this.prisma.practiceSession.findUniqueOrThrow({
      where: { id: sessionId },
      select: { status: true },
    });
    const completed = session.status === 'COMPLETED';

    return {
      correct: attempt.isCorrect,
      dontKnow: attempt.isDontKnow,
      alreadyAnswered: true,
      word,
      // No XP a second time, whatever the first answer earned (FR-034).
      xpAwarded: 0,
      mastery: { before: attempt.levelBefore, after: attempt.levelAfter },
      sessionCompleted: completed,
      summary: completed ? await this.summary(sessionId) : null,
    };
  }

  /** What the learner achieved, once every question has been answered (FR-035). */
  private async summary(sessionId: string) {
    const attempts = await this.prisma.attempt.findMany({
      where: { sessionId },
      orderBy: { answeredAt: 'asc' },
      include: { vocabularyWord: { select: { english: true } } },
    });

    return summaryOf(
      attempts.map((attempt) => ({
        isCorrect: attempt.isCorrect,
        xpAwarded: attempt.xpAwarded,
        levelBefore: attempt.levelBefore,
        levelAfter: attempt.levelAfter,
        english: attempt.vocabularyWord.english,
      })),
    );
  }
}

/** Prisma reports a broken constraint as an error carrying Postgres's code. */
const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === UNIQUE_VIOLATION;
