import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/auth-card';
import { ProviderSection } from '@/components/auth/provider-section';
import { SignInForm } from '@/components/auth/sign-in-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { messageForProviderError } from '@/lib/api/provider-errors';

export const metadata: Metadata = { title: 'เข้าสู่ระบบ · LanguZe' };

export default async function SignInPage({
  searchParams,
}: {
  // A provider sign-in that fails comes back here with Better Auth's own code,
  // and repeating a parameter is legal, so this may arrive as a list (US-004).
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  const message = messageForProviderError(error);

  return (
    <AuthCard
      title="เข้าสู่ระบบ"
      footer={
        <>
          ยังไม่มีบัญชี?{' '}
          <Link href="/sign-up" className="underline underline-offset-4">
            สมัครใช้งาน
          </Link>
        </>
      }
    >
      {message ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      <SignInForm />
      <ProviderSection />
    </AuthCard>
  );
}
