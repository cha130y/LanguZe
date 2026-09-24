import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';

/** An analysis that has run this long is lost, not slow (V16, FR-021). */
export const ANALYSIS_TIMEOUT_MS = 5 * 60_000;

export const staleBefore = (now: Date): Date =>
  new Date(now.getTime() - ANALYSIS_TIMEOUT_MS);

/**
 * Releases analyses that never finished (V16).
 *
 * Background work lives in the API process (P2), so a restart in the middle of an
 * analysis leaves a world saying "analysing" for ever and an analysis counted
 * against the learner's day. This runs at startup, which is exactly when that has
 * just happened, and every minute afterwards for a run that hung.
 */
@Injectable()
export class StaleAnalysisService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StaleAnalysisService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** A restart is the usual reason an analysis is lost, so this runs first. */
  async onApplicationBootstrap(): Promise<void> {
    await this.release(new Date());
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async releaseLostAnalyses(): Promise<void> {
    await this.release(new Date());
  }

  /** Returns how many were released, which the tests and the logs use. */
  async release(now: Date): Promise<number> {
    const stale = await this.prisma.analysis.findMany({
      where: { status: 'IN_PROGRESS', startedAt: { lt: staleBefore(now) } },
      select: { id: true, worldId: true },
    });
    if (stale.length === 0) return 0;

    const worldIds = stale
      .map(({ worldId }) => worldId)
      .filter((worldId) => worldId !== null);

    await this.prisma.$transaction([
      this.prisma.analysis.updateMany({
        where: { id: { in: stale.map(({ id }) => id) } },
        // Released, because the learner's photo may have been perfectly good (FR-025).
        data: { status: 'FAILED', failureReason: 'TIMED_OUT', finishedAt: now },
      }),
      this.prisma.world.updateMany({
        // Only a world still waiting: one that finished another way is left alone.
        where: { id: { in: worldIds }, status: 'ANALYZING' },
        data: { status: 'FAILED', failureReason: 'TIMED_OUT' },
      }),
    ]);

    this.logger.log(
      `Released ${stale.length} analysis(es) that never finished`,
    );
    return stale.length;
  }
}
