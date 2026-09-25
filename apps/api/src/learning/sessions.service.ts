import { HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../platform/errors/app-error.js';
import { ErrorCode } from '../platform/errors/error-codes.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PhotoStorage } from '../storage/photo-storage.js';
import type { SessionDto } from './dto/sessions.dto.js';
import { selectQuestions } from './question-selection.js';

/** How long an unfinished session stays open (V17, FR-036). */
export const SESSION_OPEN_MS = 24 * 60 * 60 * 1000;

/** Everything a session's page needs, in one read. */
const WITH_QUESTIONS = {
  questions: {
    orderBy: { position: 'asc' },
    include: {
      attempt: { select: { id: true } },
      occurrence: { include: { world: { include: { photo: true } } } },
    },
  },
} as const;

type SessionWithQuestions = Prisma.PracticeSessionGetPayload<{
  include: typeof WITH_QUESTIONS;
}>;

/**
 * Starting a session and knowing where the learner is in it (FR-030, FR-036).
 * Answering is the `attempts` half of the module; this half never writes an answer.
 */
@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: PhotoStorage,
  ) {}

  /**
   * A new game for a world (FR-030). The questions are chosen and written once,
   * here, so that the session a learner comes back to tomorrow asks the same words
   * in the same order as the one they left.
   */
  async start(learnerId: string, worldId: string): Promise<SessionDto> {
    const world = await this.prisma.world.findFirst({
      where: { id: worldId, learnerId },
      include: {
        occurrences: {
          include: { vocabularyWord: { include: { mastery: true } } },
        },
      },
    });
    // A world that is not the learner's is missing, not forbidden (FR-008).
    if (!world) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        HttpStatus.NOT_FOUND,
        'This world does not exist.',
      );
    }
    if (world.status !== 'READY' || world.occurrences.length === 0) {
      throw new AppError(
        ErrorCode.WORLD_NOT_READY,
        HttpStatus.CONFLICT,
        'This world has no words to play with yet.',
      );
    }

    const chosen = selectQuestions(
      world.occurrences.map((occurrence) => ({
        occurrenceId: occurrence.id,
        vocabularyWordId: occurrence.vocabularyWordId,
        level: occurrence.vocabularyWord.mastery?.level ?? null,
      })),
    );

    /*
     * Closing the old session and opening the new one together is what keeps a
     * learner to one unfinished game per world (FR-036). The database holds the
     * same rule as a partial unique index, so two requests at once cannot both win.
     */
    const session = await this.prisma.$transaction(async (tx) => {
      await tx.practiceSession.updateMany({
        where: { learnerId, worldId, kind: 'GAME', status: 'IN_PROGRESS' },
        data: { status: 'ABANDONED' },
      });

      return tx.practiceSession.create({
        data: {
          learnerId,
          kind: 'GAME',
          worldId,
          questions: {
            create: chosen.map((question, index) => ({
              position: index + 1,
              vocabularyWordId: question.vocabularyWordId,
              occurrenceId: question.occurrenceId,
            })),
          },
        },
        include: WITH_QUESTIONS,
      });
    });

    return this.toDto(session);
  }

  /**
   * The game still open for this world, if there is one (FR-036). A learner who
   * closed the tab, or whose in-app browser reloaded the page, comes back to the
   * question they were on rather than to a session they cannot find.
   */
  async current(
    learnerId: string,
    worldId: string,
  ): Promise<SessionDto | null> {
    const session = await this.prisma.practiceSession.findFirst({
      where: { learnerId, worldId, kind: 'GAME', status: 'IN_PROGRESS' },
      include: WITH_QUESTIONS,
    });
    if (!session) return null;

    const open = await this.closeIfStale(session);
    return open ? this.toDto(open) : null;
  }

  /** One session of this learner's, whatever state it is in. */
  async get(learnerId: string, sessionId: string): Promise<SessionDto> {
    const session = await this.prisma.practiceSession.findFirst({
      where: { id: sessionId, learnerId },
      include: WITH_QUESTIONS,
    });
    if (!session) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        HttpStatus.NOT_FOUND,
        'This session does not exist.',
      );
    }

    return this.toDto((await this.closeIfStale(session)) ?? session);
  }

  /**
   * A session left unfinished for a day is over (V17). It is closed when someone
   * looks at it rather than by a scheduled task: nothing depends on the row
   * changing before then, and a task that swept every learner's sessions every
   * minute would do that work for nobody's benefit.
   */
  private async closeIfStale(
    session: SessionWithQuestions,
  ): Promise<SessionWithQuestions | null> {
    if (session.status !== 'IN_PROGRESS') return session;
    if (Date.now() - session.startedAt.getTime() < SESSION_OPEN_MS) {
      return session;
    }

    await this.prisma.practiceSession.updateMany({
      where: { id: session.id, status: 'IN_PROGRESS' },
      data: { status: 'ABANDONED' },
    });
    return null;
  }

  private async toDto(session: SessionWithQuestions): Promise<SessionDto> {
    const answeredCount = session.questions.filter((q) => q.attempt).length;
    /*
     * A question whose word was removed since the session started is skipped
     * (UC-030 3a): the learner asked for that word to go, so the game does not
     * insist on it.
     */
    const next = session.questions.find((q) => !q.attempt && q.occurrence);

    return {
      id: session.id,
      kind: session.kind,
      status: session.status,
      worldId: session.worldId,
      answeredCount,
      questionCount: session.questions.length,
      nextQuestion:
        next && next.occurrence
          ? {
              id: next.id,
              position: next.position,
              photoUrl: next.occurrence.world.photo
                ? await this.storage.signedLink(
                    next.occurrence.world.photo.storageKey,
                  )
                : null,
              box: {
                x: next.occurrence.boxX,
                y: next.occurrence.boxY,
                width: next.occurrence.boxWidth,
                height: next.occurrence.boxHeight,
              },
            }
          : null,
      startedAt: session.startedAt.toISOString(),
    };
  }
}
