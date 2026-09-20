import type { Metadata } from 'next';
import { AuthCard } from '@/components/auth/auth-card';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const metadata: Metadata = { title: 'ตั้งรหัสผ่านใหม่ · LanguZe' };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <AuthCard title="ตั้งรหัสผ่านใหม่">
      <ResetPasswordForm token={token ?? null} />
    </AuthCard>
  );
}
