import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { api, ApiError } from '@/lib/api/client';
import { SignInForm } from './sign-in-form';

const push = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock('@/lib/api/client', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api/client')>(
      '@/lib/api/client',
    );
  return { ...actual, api: { signIn: vi.fn() } };
});

beforeEach(() => {
  vi.mocked(api.signIn).mockReset();
  push.mockReset();
  refresh.mockReset();
});

test('asks for the missing fields before calling the API', async () => {
  const user = userEvent.setup();
  render(<SignInForm />);

  await user.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));

  expect(
    await screen.findByText('กรุณากรอกอีเมลให้ถูกต้อง'),
  ).toBeInTheDocument();
  expect(api.signIn).not.toHaveBeenCalled();
});

test('signs in and goes to the home page', async () => {
  const user = userEvent.setup();
  vi.mocked(api.signIn).mockResolvedValue({} as never);
  render(<SignInForm />);

  await user.type(screen.getByLabelText('อีเมล'), 'nok@example.com');
  await user.type(screen.getByLabelText('รหัสผ่าน'), 'correct horse battery');
  await user.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));

  await waitFor(() => {
    expect(api.signIn).toHaveBeenCalledWith({
      email: 'nok@example.com',
      password: 'correct horse battery',
    });
  });
  expect(push).toHaveBeenCalledWith('/');
});

test('shows the Thai message for a refused sign-in', async () => {
  const user = userEvent.setup();
  vi.mocked(api.signIn).mockRejectedValue(
    new ApiError(
      'INVALID_CREDENTIALS',
      401,
      'The email address or password is incorrect.',
    ),
  );
  render(<SignInForm />);

  await user.type(screen.getByLabelText('อีเมล'), 'nok@example.com');
  await user.type(screen.getByLabelText('รหัสผ่าน'), 'wrong password');
  await user.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  );
  expect(push).not.toHaveBeenCalled();
});
