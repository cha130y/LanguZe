import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate limits per account when signed in, otherwise per IP address (API design, section 5).
 * Counts are kept in memory, which is enough for the single API instance of Release 1.0 (A2).
 */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, any>): Promise<string> {
    const accountId = (req.user as { id?: unknown } | undefined)?.id;
    return Promise.resolve(
      typeof accountId === 'string'
        ? `account:${accountId}`
        : `ip:${String(req.ip)}`,
    );
  }
}
