import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * How long a provider sign-up may sit without accepting the Terms of Use before it
 * is removed (FR-090, U5). Long enough to read the Terms, short enough that an
 * abandoned attempt leaves nothing behind.
 */
export const PENDING_SIGN_UP_TTL_MS = 15 * 60_000;

/** The moment before which a pending sign-up has expired. */
export const pendingSignUpCutoff = (now: Date = new Date()): Date =>
  new Date(now.getTime() - PENDING_SIGN_UP_TTL_MS);

/**
 * Removes provider sign-ups that never accepted the Terms. Declining removes the
 * account immediately; this catches the visitor who simply closed the tab.
 *
 * Runs on the single API instance (A2). If LanguZe ever runs more than one, this
 * needs a lock so two instances do not sweep at the same time.
 */
@Injectable()
export class PendingSignUpCleanupService {
  private readonly logger = new Logger(PendingSignUpCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async removeExpired(): Promise<void> {
    const { count } = await this.sweep();
    // Nothing identifying: a count is enough to see the rule working (NFR-008).
    if (count > 0) {
      this.logger.log(`Removed ${count} expired provider sign-up(s)`);
    }
  }

  /** Separate from the schedule so a test can run one sweep directly. */
  sweep(now: Date = new Date()): Promise<{ count: number }> {
    return this.prisma.user.deleteMany({
      where: {
        termsAcceptedAt: null,
        createdAt: { lt: pendingSignUpCutoff(now) },
      },
    });
  }
}
