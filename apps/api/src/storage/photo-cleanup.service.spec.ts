import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { FakePhotoStorage } from './fake-photo-storage.js';
import { PhotoCleanupService, retryDelayMs } from './photo-cleanup.service.js';

const NOW = new Date('2026-09-24T10:00:00.000Z');

interface Record {
  id: string;
  storageKey: string;
  attempts: number;
}

/** What the service writes back when an attempt fails. */
interface Postponement {
  attempts: number;
  nextAttemptAt: Date;
  lastError: string;
}

/** A database with the given cleanup records, remembering what the sweep did to them. */
function cleanupWith(records: Record[]) {
  const storage = new FakePhotoStorage();
  const deleted: string[] = [];
  const updates: { id: string; data: Postponement }[] = [];
  const findMany = vi.fn().mockResolvedValue(records);

  const prisma = {
    photoDeletion: {
      findMany,
      delete: vi.fn(({ where }: { where: { id: string } }) => {
        deleted.push(where.id);
        return Promise.resolve({});
      }),
      update: vi.fn((args: { where: { id: string }; data: Postponement }) => {
        updates.push({ id: args.where.id, data: args.data });
        return Promise.resolve({});
      }),
    },
  } as unknown as PrismaService;

  for (const record of records) {
    storage.objects.set(record.storageKey, {
      key: record.storageKey,
      body: Buffer.from('photo'),
      contentType: 'image/jpeg',
    });
  }

  return {
    service: new PhotoCleanupService(prisma, storage),
    storage,
    deleted,
    updates,
    findMany,
  };
}

describe('retryDelayMs', () => {
  it('waits longer after each failure, then settles at an hour', () => {
    expect(retryDelayMs(1)).toBe(60_000);
    expect(retryDelayMs(2)).toBe(5 * 60_000);
    expect(retryDelayMs(3)).toBe(15 * 60_000);
    expect(retryDelayMs(4)).toBe(60 * 60_000);
    // Still an hour much later, so a stuck record keeps being tried inside the day.
    expect(retryDelayMs(30)).toBe(60 * 60_000);
  });
});

describe('PhotoCleanupService (NFR-009)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('takes only the records whose time has come', async () => {
    const { service, findMany } = cleanupWith([]);

    await service.sweep(NOW);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { nextAttemptAt: { lte: NOW } } }),
    );
  });

  it('removes the object and then the record', async () => {
    const { service, storage, deleted } = cleanupWith([
      { id: 'a', storageKey: 'prepared/one.jpg', attempts: 0 },
      { id: 'b', storageKey: 'thumbnail/two.jpg', attempts: 0 },
    ]);

    expect(await service.sweep(NOW)).toBe(2);

    expect(storage.objects.size).toBe(0);
    expect(deleted).toEqual(['a', 'b']);
  });

  /*
   * The whole point of the record: storage failing must never lose the photo. It
   * stays, with a later time and the reason, and is tried again.
   */
  it('keeps a record whose object could not be removed', async () => {
    const { service, storage, deleted, updates } = cleanupWith([
      { id: 'a', storageKey: 'prepared/stuck.jpg', attempts: 2 },
    ]);
    storage.failing.add('prepared/stuck.jpg');

    expect(await service.sweep(NOW)).toBe(0);

    expect(deleted).toEqual([]);
    expect(updates).toHaveLength(1);
    expect(updates[0].data.attempts).toBe(3);
    expect(updates[0].data.nextAttemptAt).toEqual(
      new Date(NOW.getTime() + 15 * 60_000),
    );
    expect(updates[0].data.lastError).toContain('prepared/stuck.jpg');
  });

  it('carries on with the rest when one object fails', async () => {
    const { service, storage, deleted } = cleanupWith([
      { id: 'a', storageKey: 'prepared/stuck.jpg', attempts: 0 },
      { id: 'b', storageKey: 'prepared/fine.jpg', attempts: 0 },
    ]);
    storage.failing.add('prepared/stuck.jpg');

    expect(await service.sweep(NOW)).toBe(1);

    expect(deleted).toEqual(['b']);
    expect(storage.objects.has('prepared/stuck.jpg')).toBe(true);
  });
});
