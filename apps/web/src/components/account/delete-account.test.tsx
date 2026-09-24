import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { api } from '@/lib/api/client';
import { DeleteAccount } from './delete-account';

// There is no App Router around a test render.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  api: { deleteAccount: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(api.deleteAccount).mockReset().mockResolvedValue(undefined);
});

/** Deletion is permanent, so one press must never be enough (US-009). */
test('asks before deleting anything', async () => {
  render(<DeleteAccount />);

  await userEvent.click(screen.getByRole('button', { name: 'ลบบัญชีของฉัน' }));

  expect(api.deleteAccount).not.toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: 'ยืนยันลบบัญชีถาวร' }),
  ).toBeInTheDocument();
});

/** US-009 criterion 3: cancelling leaves the account alone. */
test('deletes nothing when the learner cancels', async () => {
  render(<DeleteAccount />);

  await userEvent.click(screen.getByRole('button', { name: 'ลบบัญชีของฉัน' }));
  await userEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }));

  expect(api.deleteAccount).not.toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: 'ลบบัญชีของฉัน' }),
  ).toBeInTheDocument();
});

test('deletes once the learner confirms', async () => {
  render(<DeleteAccount />);

  await userEvent.click(screen.getByRole('button', { name: 'ลบบัญชีของฉัน' }));
  await userEvent.click(
    screen.getByRole('button', { name: 'ยืนยันลบบัญชีถาวร' }),
  );

  expect(api.deleteAccount).toHaveBeenCalledTimes(1);
});

test('keeps the account and explains when deletion fails', async () => {
  vi.mocked(api.deleteAccount).mockRejectedValue(new Error('network'));
  render(<DeleteAccount />);

  await userEvent.click(screen.getByRole('button', { name: 'ลบบัญชีของฉัน' }));
  await userEvent.click(
    screen.getByRole('button', { name: 'ยืนยันลบบัญชีถาวร' }),
  );

  expect(await screen.findByRole('alert')).toBeInTheDocument();
  // Still on the confirmation step, so the learner can try again or cancel.
  expect(
    screen.getByRole('button', { name: 'ยืนยันลบบัญชีถาวร' }),
  ).toBeInTheDocument();
});
