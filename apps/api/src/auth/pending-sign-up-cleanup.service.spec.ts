import type { PrismaService } from '../prisma/prisma.service.js';
import {
  PENDING_SIGN_UP_TTL_MS,
  PendingSignUpCleanupService,
  pendingSignUpCutoff,
} from './pending-sign-up-cleanup.service.js';

const NOW = new Date('2026-09-21T10:00:00.000Z');

/** Captures the query instead of running it, so the rule can be read from the filter. */
function serviceWithSpy() {
  const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
  const prisma = { user: { deleteMany } } as unknown as PrismaService;
  return { service: new PendingSignUpCleanupService(prisma), deleteMany };
}

describe('pendingSignUpCutoff', () => {
  it('is fifteen minutes before the given moment', () => {
    expect(pendingSignUpCutoff(NOW).toISOString()).toBe(
      '2026-09-21T09:45:00.000Z',
    );
    expect(PENDING_SIGN_UP_TTL_MS).toBe(15 * 60_000);
  });
});

describe('PendingSignUpCleanupService', () => {
  /*
   * The two conditions matter equally. Without `termsAcceptedAt: null` the sweep
   * would delete established learners; without the cutoff it would delete a sign-up
   * that is still being read through.
   */
  it('deletes only sign-ups that are both pending and expired', async () => {
    const { service, deleteMany } = serviceWithSpy();

    await service.sweep(NOW);

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        termsAcceptedAt: null,
        createdAt: { lt: new Date('2026-09-21T09:45:00.000Z') },
      },
    });
  });

  it('never matches an account that has accepted the Terms', async () => {
    const { service, deleteMany } = serviceWithSpy();

    await service.sweep(NOW);

    const [{ where }] = deleteMany.mock.calls[0] as [
      { where: Record<string, unknown> },
    ];
    expect(where.termsAcceptedAt).toBeNull();
  });
});
