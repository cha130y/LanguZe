import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/auth-card';
import { SignInForm } from '@/components/auth/sign-in-form';

export const metadata: Metadata = { title: 'เข้าสู่ระบบ · LanguZe' };

export default function SignInPage() {
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
      <SignInForm />
    </AuthCard>
  );
}
