import { render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { Account, Usage } from '@/lib/api/client';
import { getAccount, getUsage } from '@/lib/api/server';
import NewWorldPage from './page';

vi.mock('@/lib/api/server', () => ({
  getAccount: vi.fn(),
  getUsage: vi.fn(),
}));

const redirect = vi.fn((path: string) => {
  throw new Error(`redirected to ${path}`);
});
vi.mock('next/navigation', () => {
  const router = { refresh: vi.fn(), push: vi.fn() };
  return {
    redirect: (path: string) => redirect(path),
    useRouter: () => router,
  };
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

const usage: Usage = {
  analysesLeft: 3,
  analysesLimit: 10,
  resetsAt: '2026-09-25T17:00:00.000Z',
};

beforeEach(() => {
  vi.mocked(getAccount).mockReset().mockResolvedValue(account);
  vi.mocked(getUsage).mockReset().mockResolvedValue(usage);
  redirect.mockClear();
});

test('offers the form with what is left of today (US-010, US-080)', async () => {
  render(await NewWorldPage());

  expect(screen.getByLabelText('ชื่อโลก')).toBeInTheDocument();
  expect(
    screen.getByText('วันนี้วิเคราะห์รูปได้อีก 3 จาก 10 ครั้ง'),
  ).toBeInTheDocument();
});

/*
 * US-080 criterion 2. Offering the form would mean refusing the photo only after a
 * learner had uploaded it over a phone connection.
 */
test('does not ask for a photo it would have to refuse', async () => {
  vi.mocked(getUsage).mockResolvedValue({ ...usage, analysesLeft: 0 });

  render(await NewWorldPage());

  expect(screen.queryByLabelText('ชื่อโลก')).toBeNull();
  expect(screen.getByText('วันนี้วิเคราะห์ครบแล้ว')).toBeInTheDocument();
  expect(screen.getByText(/26 ก.ย. 00:00/)).toBeInTheDocument();
});

/** FR-006: analysis is an AI feature, so it waits for a verified email. */
test('sends an unverified learner back to the list', async () => {
  vi.mocked(getAccount).mockResolvedValue({
    ...account,
    emailVerified: false,
    verifiedForAi: false,
    aiAccess: { available: false, reason: 'NOT_VERIFIED' },
  });

  await expect(NewWorldPage()).rejects.toThrow('redirected to /worlds');
});
