import { render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { Account } from '@/lib/api/client';
import { getAccount } from '@/lib/api/server';
import AccountPage from './page';

vi.mock('@/lib/api/server', () => ({ getAccount: vi.fn() }));

const redirect = vi.fn((path: string) => {
  // The real one throws to stop rendering, and the page relies on that.
  throw new Error(`redirected to ${path}`);
});

vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirect(path),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const account: Account = {
  id: '0192f0c1-8c1e-7cc3-9d2a-5b3e1c4a7f10',
  name: 'Nok',
  email: 'nok@example.com',
  emailVerified: true,
  verifiedForAi: true,
  role: 'LEARNER',
  termsAccepted: true,
  aiAccess: { available: true, reason: null },
};

beforeEach(() => {
  vi.mocked(getAccount).mockReset();
  redirect.mockClear();
});

test('shows the account, including the ID support asks for', async () => {
  vi.mocked(getAccount).mockResolvedValue(account);

  render(await AccountPage());

  expect(screen.getByText('Nok')).toBeInTheDocument();
  expect(screen.getByText('nok@example.com')).toBeInTheDocument();
  expect(screen.getByText(account.id)).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'ลบบัญชีของฉัน' }),
  ).toBeInTheDocument();
});

/** An account signed in with LINE has no address to show (D1, US-005). */
test('explains an account without an email address', async () => {
  vi.mocked(getAccount).mockResolvedValue({ ...account, email: null });

  render(await AccountPage());

  expect(screen.getByText(/ไม่มีอีเมล/)).toBeInTheDocument();
});

test('sends a visitor to sign in', async () => {
  vi.mocked(getAccount).mockResolvedValue(null);

  await expect(AccountPage()).rejects.toThrow('redirected to /sign-in');
});

test('sends an unfinished provider sign-up back to the Terms step', async () => {
  vi.mocked(getAccount).mockResolvedValue({ ...account, termsAccepted: false });

  await expect(AccountPage()).rejects.toThrow('redirected to /terms');
});
