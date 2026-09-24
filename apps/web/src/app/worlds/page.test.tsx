import { render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { Account, WorldSummary } from '@/lib/api/client';
import { getAccount, getWorlds } from '@/lib/api/server';
import WorldsPage from './page';

vi.mock('@/lib/api/server', () => ({
  getAccount: vi.fn(),
  getWorlds: vi.fn(),
}));

const redirect = vi.fn((path: string) => {
  throw new Error(`redirected to ${path}`);
});
vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirect(path),
}));

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

const world: WorldSummary = {
  id: 'world-1',
  name: 'ห้องครัว',
  status: 'READY',
  failureReason: null,
  thumbnailUrl: 'https://photos.test/thumb.jpg?X-Amz-Signature=abc',
  wordCount: 12,
  masteredCount: 3,
  createdAt: '2026-09-24T10:00:00.000Z',
};

beforeEach(() => {
  vi.mocked(getAccount).mockReset().mockResolvedValue(account);
  vi.mocked(getWorlds).mockReset().mockResolvedValue([]);
  redirect.mockClear();
});

test('shows each world with its photo and counts (FR-013)', async () => {
  vi.mocked(getWorlds).mockResolvedValue([
    world,
    {
      ...world,
      id: 'world-2',
      name: 'โต๊ะทำงาน',
      status: 'ANALYZING',
      // A world still being analysed has no words yet.
      wordCount: 0,
      masteredCount: 0,
    },
  ]);

  render(await WorldsPage());

  expect(screen.getByRole('heading', { name: 'ห้องครัว' })).toBeInTheDocument();
  expect(screen.getByText('12 คำ · จำได้แล้ว 3 คำ')).toBeInTheDocument();
  expect(screen.getByText('พร้อมเล่น')).toBeInTheDocument();
  expect(screen.getByText('กำลังวิเคราะห์…')).toBeInTheDocument();
  // The whole card is one link, so its name carries the status and the counts too,
  // which is what a screen reader should read out (NFR-012).
  expect(screen.getByRole('link', { name: /ห้องครัว/ })).toHaveAttribute(
    'href',
    '/worlds/world-1',
  );
});

/** US-011 criterion 3: an empty list explains how to start. */
test('invites a learner with no worlds to make one', async () => {
  render(await WorldsPage());

  expect(screen.getByText('ยังไม่มีโลกของคุณ')).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'สร้างโลกแรกของคุณ' }),
  ).toHaveAttribute('href', '/worlds/new');
});

/** The same story: an unverified learner is told what to do first (FR-006). */
test('asks an unverified learner to verify before creating a world', async () => {
  vi.mocked(getAccount).mockResolvedValue({
    ...account,
    emailVerified: false,
    verifiedForAi: false,
    aiAccess: { available: false, reason: 'NOT_VERIFIED' },
  });

  render(await WorldsPage());

  expect(screen.getByText('ยืนยันอีเมลก่อนสร้างโลก')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'สร้างโลกใหม่' })).toBeNull();
});

test('sends a visitor to sign in', async () => {
  vi.mocked(getAccount).mockResolvedValue(null);

  await expect(WorldsPage()).rejects.toThrow('redirected to /sign-in');
});
