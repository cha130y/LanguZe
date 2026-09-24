import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SignOutButton } from '@/components/auth/account-actions';
import { DeleteAccount } from '@/components/account/delete-account';
import { getAccount } from '@/lib/api/server';

export const metadata: Metadata = { title: 'บัญชีของฉัน · LanguZe' };

/** Account settings: what LanguZe knows, and how to leave (US-009, FR-108). */
export default async function AccountPage() {
  const account = await getAccount();

  if (!account) redirect('/sign-in');
  // A provider sign-up that has not accepted the Terms has no account yet (FR-090).
  if (!account.termsAccepted) redirect('/terms');

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <Link
          href="/"
          className="rounded text-sm text-muted-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          ← กลับหน้าแรก
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">บัญชีของฉัน</h1>
      </div>

      <section className="glass-panel grid gap-4 rounded-3xl p-6">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground">
            ชื่อที่แสดง
          </h2>
          <p className="mt-1">{account.name}</p>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-muted-foreground">อีเมล</h2>
          {account.email ? (
            <p className="mt-1 break-all">
              {account.email}
              {account.emailVerified ? null : (
                <span className="ms-2 text-sm text-muted-foreground">
                  (ยังไม่ยืนยัน)
                </span>
              )}
            </p>
          ) : (
            <p className="mt-1 text-muted-foreground">
              บัญชีนี้ไม่มีอีเมล
              เพราะเข้าสู่ระบบด้วยบัญชีภายนอกที่ไม่ได้แชร์อีเมล
              จึงไม่มีการส่งอีเมลและตั้งรหัสผ่านใหม่ไม่ได้
            </p>
          )}
        </div>

        <div>
          {/* Support can find an account by this, which matters when there is no email (FR-108). */}
          <h2 className="text-sm font-semibold text-muted-foreground">
            รหัสบัญชี
          </h2>
          <p className="mt-1 font-mono text-sm break-all">{account.id}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            ใส่รหัสนี้มาด้วยเมื่อ<Link href="/contact">ติดต่อเรา</Link>
          </p>
        </div>

        <div className="border-t border-border pt-4">
          <SignOutButton />
        </div>
      </section>

      <DeleteAccount />
    </main>
  );
}
