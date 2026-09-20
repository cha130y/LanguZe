import type { Metadata } from 'next';
import { AuthCard } from '@/components/auth/auth-card';
import { VerifyEmailView } from '@/components/auth/verify-email-view';

export const metadata: Metadata = { title: 'ยืนยันอีเมล · LanguZe' };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <AuthCard title="ยืนยันอีเมล">
      <VerifyEmailView token={token ?? null} />
    </AuthCard>
  );
}
