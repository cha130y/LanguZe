import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { PhotoStorage } from './photo-storage.js';

/** How many cleanup records one sweep takes, so a backlog cannot stall the task. */
const BATCH_SIZE = 50;

/**
 * How long to wait after a failed attempt, by attempt number. Deletion has to happen
 * within 24 hours of the request (V10), so the waits stay short enough for many tries
 * inside that window; anything beyond the list repeats the last one.
 */
const RETRY_DELAYS_MS = [
  1 * 60_000, // 1 minute
  5 * 60_000,
  15 * 60_000,
  60 * 60_000, // an hour, from the fourth attempt on
];

export const retryDelayMs = (attempts: number): number =>
  RETRY_DELAYS_MS[Math.min(attempts, RETRY_DELAYS_MS.length) - 1] ??
  RETRY_DELAYS_MS[0];

/**
 * Removes photos from storage after the row that referenced them is gone (NFR-009).
 *
 * The deletion of a world or an account writes a cleanup record in the same
 * transaction as the database change, so the two can never disagree: the record
 * exists exactly when an object still has to go. This task then does the slow,
 * failable part — talking to object storage — on its own, and a failure only means
 * the record is tried again, never that a photo is quietly kept (V10).
 */
@Injectable()
export class PhotoCleanupService {
  private readonly logger = new Logger(PhotoCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: PhotoStorage,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async removeDeletedPhotos(): Promise<void> {
    await this.sweep(new Date());
  }

  /** Returns how many objects were removed, which the tests and the logs use. */
  async sweep(now: Date): Promise<number> {
    const due = await this.prisma.photoDeletion.findMany({
      where: { nextAttemptAt: { lte: now } },
      orderBy: { nextAttemptAt: 'asc' },
      take: BATCH_SIZE,
    });

    let removed = 0;
    for (const record of due) {
      try {
        await this.storage.remove(record.storageKey);
        await this.prisma.photoDeletion.delete({ where: { id: record.id } });
        removed += 1;
      } catch (error) {
        await this.postpone(record.id, record.attempts, error, now);
      }
    }

    if (removed > 0)
      this.logger.log(`Removed ${removed} photo(s) from storage`);
    return removed;
  }

  private async postpone(
    id: string,
    attempts: number,
    error: unknown,
    now: Date,
  ): Promise<void> {
    const next = attempts + 1;
    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn(`Photo cleanup attempt ${next} failed: ${message}`);

    await this.prisma.photoDeletion.update({
      where: { id },
      data: {
        attempts: next,
        nextAttemptAt: new Date(now.getTime() + retryDelayMs(next)),
        // Long provider errors are cut to fit the column and to keep logs readable.
        lastError: message.slice(0, 500),
      },
    });
  }
}
