import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { bangkokDay } from '../platform/time/bangkok-day.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { TutorConversationDto } from './dto/tutor.dto.js';

/** How many messages one page of the conversation carries. */
export const MESSAGES_PER_PAGE = 30;

/**
 * The learner's one conversation with the tutor (FR-070, V6), and how many
 * messages they have left today (FR-071).
 *
 * Sending a message lives with the streaming endpoint; this half only reads what
 * is already there and throws it away when asked.
 */
@Injectable()
export class TutorService {
  private readonly dailyLimit: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.dailyLimit = config.get('DAILY_TUTOR_MESSAGE_LIMIT', { infer: true });
  }

  /**
   * The conversation, newest first. Older messages come a page at a time, so a
   * long conversation does not have to be read in full to show the last thing
   * said — which is all a learner opening the page wants to see.
   */
  async conversation(
    learnerId: string,
    before?: string,
  ): Promise<TutorConversationDto> {
    const messages = await this.prisma.tutorMessage.findMany({
      where: { learnerId },
      orderBy: { createdAt: 'desc' },
      take: MESSAGES_PER_PAGE + 1,
      ...(before ? { cursor: { id: before }, skip: 1 } : {}),
    });

    // One more was asked for than fits, so its presence answers "is there more?".
    const page = messages.slice(0, MESSAGES_PER_PAGE);

    return {
      messages: page.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      })),
      nextCursor:
        messages.length > MESSAGES_PER_PAGE ? (page.at(-1)?.id ?? null) : null,
    };
  }

  /**
   * Throws the conversation away (FR-076). Today's message count is untouched:
   * the messages were sent, and forgetting them does not unsend them (US-073).
   */
  async clear(learnerId: string): Promise<void> {
    await this.prisma.tutorMessage.deleteMany({ where: { learnerId } });
  }

  /** How many messages are left today, and how many a learner gets (FR-071). */
  async usage(learnerId: string, now = new Date()) {
    const today = await this.prisma.tutorDailyUsage.findUnique({
      where: { learnerId_day: { learnerId, day: dayOf(now) } },
    });
    const used = today?.messagesUsed ?? 0;

    return {
      used,
      limit: this.dailyLimit,
      left: Math.max(0, this.dailyLimit - used),
    };
  }
}

/**
 * The Bangkok day as a date, which is what the table keeps (V1). A `date` column
 * holds a day rather than an instant, so it is built from the day itself instead
 * of from a moment that a time zone could move.
 */
export const dayOf = (now: Date): Date =>
  new Date(`${bangkokDay(now)}T00:00:00Z`);
