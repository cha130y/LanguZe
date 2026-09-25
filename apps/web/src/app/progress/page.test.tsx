import { render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { Account, Progress } from '@/lib/api/client';
import { getAccount, getProgress } from '@/lib/api/server';
import ProgressPage from './page';

vi.mock('@/lib/api/server', () => ({
  getAccount: vi.fn(),
  getProgress: vi.fn(),
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

const progress: Progress = {
  totalXp: 240,
  words: { NEW: 4, LEARNING: 3, FAMILIAR: 2, MASTERED: 1 },
  worlds: [
    { id: 'world-1', name: 'ห้องครัว', wordCount: 6, masteredCount: 1 },
    { id: 'world-2', name: 'โต๊ะทำงาน', wordCount: 4, masteredCount: 0 },
  ],
};

beforeEach(() => {
  vi.mocked(getAccount).mockReset().mockResolvedValue(account);
  vi.mocked(getProgress).mockReset().mockResolvedValue(progress);
  redirect.mockClear();
});

test('shows the XP, the levels, and each world (US-060)', async () => {
  render(await ProgressPage());

  expect(screen.getByText('240 XP')).toBeInTheDocument();
  expect(screen.getByText('คำศัพท์ของฉัน (10 คำ)')).toBeInTheDocument();
  expect(screen.getByText('ยังไม่ได้ฝึก')).toBeInTheDocument();
  expect(screen.getByText('4 คำ')).toBeInTheDocument();
  expect(screen.getByText('จำได้แล้ว')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /ห้องครัว/ })).toHaveAttribute(
    'href',
    '/worlds/world-1',
  );
  expect(screen.getByText('6 คำ · จำได้แล้ว 1 คำ')).toBeInTheDocument();
});

test('invites a learner with nothing yet to make a world', async () => {
  vi.mocked(getProgress).mockResolvedValue({
    totalXp: 0,
    words: { NEW: 0, LEARNING: 0, FAMILIAR: 0, MASTERED: 0 },
    worlds: [],
  });

  render(await ProgressPage());

  expect(screen.getByText('0 XP')).toBeInTheDocument();
  expect(screen.getByText(/ยังไม่มีคำศัพท์/)).toBeInTheDocument();
  expect(screen.getByText('ยังไม่มีโลกของคุณ')).toBeInTheDocument();
});

/* The page must not claim a score it could not read. */
test('says so when the API could not answer', async () => {
  vi.mocked(getProgress).mockResolvedValue(null);

  render(await ProgressPage());

  expect(screen.getByText(/ยังดูความคืบหน้าไม่ได้/)).toBeInTheDocument();
  expect(screen.queryByText(/XP/)).toBeNull();
});

test('sends a visitor to sign in', async () => {
  vi.mocked(getAccount).mockResolvedValue(null);

  await expect(ProgressPage()).rejects.toThrow('redirected to /sign-in');
});
