import { render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { Account } from '@/lib/api/client';
import { getAccount } from '@/lib/api/server';
import Home from './page';

vi.mock('@/lib/api/server', () => ({ getAccount: vi.fn() }));

// The page renders client components that ask the router to refresh after signing out,
// and there is no App Router around a test render.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const account: Account = {
  id: '0192f0c1-8c1e-7cc3-9d2a-5b3e1c4a7f10',
  name: 'Nok',
  email: 'nok@example.com',
  emailVerified: false,
  verifiedForAi: false,
  role: 'LEARNER',
  termsAccepted: true,
  aiAccess: { available: false, reason: 'NOT_VERIFIED' },
};

beforeEach(() => {
  vi.mocked(getAccount).mockReset();
});

test('invites a visitor to sign up or sign in', async () => {
  vi.mocked(getAccount).mockResolvedValue(null);

  render(await Home());

  expect(
    screen.getByRole('heading', { level: 1, name: 'LanguZe' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'สมัครใช้งาน' })).toHaveAttribute(
    'href',
    '/sign-up',
  );
  expect(screen.getByRole('link', { name: 'เข้าสู่ระบบ' })).toHaveAttribute(
    'href',
    '/sign-in',
  );
});

test('greets a signed-in learner and offers to sign out', async () => {
  vi.mocked(getAccount).mockResolvedValue({
    ...account,
    emailVerified: true,
    verifiedForAi: true,
    aiAccess: { available: true, reason: null },
  });

  render(await Home());

  expect(screen.getByText('สวัสดี Nok')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'ออกจากระบบ' }),
  ).toBeInTheDocument();
  expect(screen.queryByText(/ยืนยันอีเมลเพื่อปลดล็อก/)).not.toBeInTheDocument();
});

test('tells an unverified learner that AI features are locked (US-008)', async () => {
  vi.mocked(getAccount).mockResolvedValue(account);

  render(await Home());

  expect(
    screen.getByText(/ยืนยันอีเมลเพื่อปลดล็อกฟีเจอร์ AI/),
  ).toBeInTheDocument();
  expect(screen.getByText(/nok@example.com/)).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'ส่งอีเมลยืนยันอีกครั้ง' }),
  ).toBeInTheDocument();
});
