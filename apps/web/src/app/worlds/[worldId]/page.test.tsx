import { render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { Account, World, WorldWord } from '@/lib/api/client';
import { getAccount, getCurrentGame, getWorld } from '@/lib/api/server';
import WorldPage from './page';

vi.mock('@/lib/api/server', () => ({
  getAccount: vi.fn(),
  getCurrentGame: vi.fn(),
  getWorld: vi.fn(),
}));

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  api: {
    worldStatus: vi.fn(() => new Promise(() => {})),
    startGame: vi.fn(),
  },
}));

const { redirect, notFound } = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirected to ${path}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('not found');
  }),
}));
vi.mock('next/navigation', () => {
  const router = { refresh: vi.fn(), push: vi.fn() };
  return { redirect, notFound, useRouter: () => router };
});

const account: Account = {
  id: 'learner-1',
  name: 'Nok',
  email: 'nok@example.com',
  emailVerified: true,
  verifiedForAi: true,
  role: 'LEARNER',
  termsAccepted: true,
  aiAccess: { available: true, reason: null },
};

const word: WorldWord = {
  id: 'word-1',
  english: 'sofa',
  thaiMeaning: 'โซฟา',
  exampleSentence: 'We sit on the sofa.',
  cefrLevel: 'A1',
  box: { x: 0.2, y: 0.1, width: 0.4, height: 0.25 },
  mastery: 'NEW',
};

const world = (overrides: Partial<World> = {}) =>
  ({
    id: 'world-1',
    name: 'ห้องครัว',
    status: 'READY',
    failureReason: null,
    photoUrl: 'https://photos.test/photo.jpg?X-Amz-Signature=abc',
    thumbnailUrl: null,
    wordCount: 1,
    masteredCount: 0,
    createdAt: '2026-09-24T10:00:00.000Z',
    words: [word],
    ...overrides,
  }) as World;

const params = Promise.resolve({ worldId: 'world-1' });

beforeEach(() => {
  vi.mocked(getAccount).mockReset().mockResolvedValue(account);
  vi.mocked(getWorld).mockReset().mockResolvedValue(world());
  vi.mocked(getCurrentGame).mockReset().mockResolvedValue(null);
  redirect.mockClear();
  notFound.mockClear();
});

test('shows the words of a world that is ready (FR-014)', async () => {
  render(await WorldPage({ params }));

  expect(screen.getByRole('heading', { name: 'ห้องครัว' })).toBeInTheDocument();
  expect(screen.getByText('พร้อมเล่น')).toBeInTheDocument();
  expect(screen.getByText('sofa')).toBeInTheDocument();
});

/** FR-021: a world still being analysed says so instead of showing an empty list. */
test('waits while the photo is being analysed', async () => {
  vi.mocked(getWorld).mockResolvedValue(
    world({ status: 'ANALYZING', words: [] }),
  );

  render(await WorldPage({ params }));

  expect(screen.getByText('กำลังวิเคราะห์รูปภาพ…')).toBeInTheDocument();
  expect(screen.queryByText('sofa')).toBeNull();
});

test('offers a way out of a failed analysis (US-021)', async () => {
  vi.mocked(getWorld).mockResolvedValue(
    world({ status: 'FAILED', failureReason: 'PROVIDER_ERROR', words: [] }),
  );

  render(await WorldPage({ params }));

  expect(screen.getByText('ระบบ AI ขัดข้องชั่วคราว')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'วิเคราะห์รูปเดิมอีกครั้ง' }),
  ).toBeInTheDocument();
});

/** FR-008: another learner's world is missing, not forbidden. */
test('shows nothing for a world that is not the learner’s', async () => {
  vi.mocked(getWorld).mockResolvedValue(null);

  await expect(WorldPage({ params })).rejects.toThrow('not found');
});

test('sends a visitor to sign in', async () => {
  vi.mocked(getAccount).mockResolvedValue(null);

  await expect(WorldPage({ params })).rejects.toThrow('redirected to /sign-in');
});

/** US-012 criterion 2: a ready world is one you can play. */
test('offers a game on a world that is ready (US-030)', async () => {
  render(await WorldPage({ params }));

  expect(
    screen.getByRole('button', { name: 'เริ่มเล่นเกม' }),
  ).toBeInTheDocument();
  expect(getCurrentGame).toHaveBeenCalledWith('world-1');
});

/* US-034 criterion 3: the game left unfinished is offered back first. */
test('offers to continue an unfinished game', async () => {
  vi.mocked(getCurrentGame).mockResolvedValue({
    id: 'session-9',
    kind: 'GAME',
    status: 'IN_PROGRESS',
    worldId: 'world-1',
    answeredCount: 5,
    questionCount: 10,
    nextQuestion: null,
    startedAt: '2026-09-25T04:00:00.000Z',
    summary: null,
  } as Awaited<ReturnType<typeof getCurrentGame>>);

  render(await WorldPage({ params }));

  expect(
    screen.getByRole('link', { name: 'เล่นต่อ (ข้อ 6 จาก 10)' }),
  ).toHaveAttribute('href', '/sessions/session-9');
});

/* A world with no words to play is never asked about, and offers no game. */
test('offers no game while a world is still being analysed', async () => {
  vi.mocked(getWorld).mockResolvedValue(
    world({ status: 'ANALYZING', words: [] }),
  );

  render(await WorldPage({ params }));

  expect(screen.queryByRole('button', { name: 'เริ่มเล่นเกม' })).toBeNull();
  expect(getCurrentGame).not.toHaveBeenCalled();
});
