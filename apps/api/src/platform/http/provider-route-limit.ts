import type { ThrottlerStorage } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { HttpStatus } from '@nestjs/common';
import { AppError } from '../errors/app-error.js';
import { ErrorCode } from '../errors/error-codes.js';

const WINDOW_MS = 60_000;
const WINDOW_SECONDS = WINDOW_MS / 1000;

/**
 * Rate limits the Better Auth provider routes (API design, section 5).
 *
 * Those routes are Express middleware mounted before Nest's router, so the
 * ThrottlerGuard never sees them, and starting a sign-in writes a row for the
 * one-time state value. Requests are counted per IP address, because nobody is
 * signed in yet, and in the guard's own storage, with keys of their own so that a
 * learner's ordinary requests and their sign-in attempts keep separate budgets.
 */
export function providerRouteLimit(storage: ThrottlerStorage, limit: number) {
  return async (req: Request, res: Response): Promise<void> => {
    const { totalHits } = await storage.increment(
      `provider-route:${req.ip ?? 'unknown'}`,
      WINDOW_MS,
      limit,
      // The storage only refuses a request while the caller is blocked, and a zero
      // block clears itself in the same call, so the block lasts the whole window.
      WINDOW_MS,
      'default',
    );
    if (totalHits <= limit) return;

    res.setHeader('Retry-After', WINDOW_SECONDS);
    throw new AppError(
      ErrorCode.RATE_LIMITED,
      HttpStatus.TOO_MANY_REQUESTS,
      'Too many sign-in attempts. Please wait a moment and try again.',
    );
  };
}
