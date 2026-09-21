import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/auth-card';
import { ProviderButtons } from '@/components/auth/provider-buttons';
import { SignUpForm } from '@/components/auth/sign-up-form';

export const metadata: Metadata = { title: 'สมัครใช้งาน · LanguZe' };

export default function SignUpPage() {
  return (
    <AuthCard
      title="สมัครใช้งาน"
      description="เรียนคำศัพท์จากสิ่งรอบตัวคุณ สำหรับผู้ที่มีอายุ 18 ปีขึ้นไป"
      footer={
        <>
          มีบัญชีอยู่แล้ว?{' '}
          <Link href="/sign-in" className="underline underline-offset-4">
            เข้าสู่ระบบ
          </Link>
        </>
      }
    >
      <SignUpForm />
      <div className="mt-5">
        <ProviderButtons providers={['google']} />
      </div>
    </AuthCard>
  );
}
