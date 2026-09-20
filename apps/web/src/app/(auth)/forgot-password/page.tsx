import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/auth-card';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export const metadata: Metadata = { title: 'ลืมรหัสผ่าน · LanguZe' };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="ลืมรหัสผ่าน"
      description="กรอกอีเมลของคุณ แล้วเราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้"
      footer={
        <Link href="/sign-in" className="underline underline-offset-4">
          กลับไปหน้าเข้าสู่ระบบ
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
