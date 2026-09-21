import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/auth/auth-card';
import { TermsForm } from '@/components/auth/terms-form';
import { getAccount } from '@/lib/api/server';

export const metadata: Metadata = { title: 'ยอมรับข้อกำหนด · LanguZe' };

/**
 * Where a first-time provider sign-up lands (FR-090, U5). Better Auth sends new
 * accounts here through `newUserCallbackURL`; an account that already accepted goes
 * straight home instead, which also covers reloading this page afterwards.
 */
export default async function TermsPage() {
  const account = await getAccount();

  if (!account) redirect('/sign-in');
  if (account.termsAccepted) redirect('/');

  return (
    <AuthCard
      title="อีกขั้นเดียว"
      description="ยืนยันชื่อที่ใช้แสดงและปีเกิด แล้วยอมรับข้อกำหนดเพื่อเริ่มใช้งาน"
    >
      <TermsForm suggestedName={account.name} />
    </AuthCard>
  );
}
