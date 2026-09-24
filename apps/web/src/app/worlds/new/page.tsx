import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CreateWorldForm } from '@/components/worlds/create-world-form';
import { getAccount } from '@/lib/api/server';

export const metadata: Metadata = { title: 'สร้างโลกใหม่ · LanguZe' };

/** Naming a place and uploading its photo (US-010). */
export default async function NewWorldPage() {
  const account = await getAccount();

  if (!account) redirect('/sign-in');
  if (!account.termsAccepted) redirect('/terms');
  // Analysis is an AI feature, so an unverified learner is sent back to the list,
  // which explains what to do about it (FR-006).
  if (!account.verifiedForAi) redirect('/worlds');

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <Link
          href="/worlds"
          className="rounded text-sm text-muted-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          ← โลกของฉัน
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">สร้างโลกใหม่</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ตั้งชื่อสถานที่ แล้วใส่รูปภาพหนึ่งรูป
        </p>
      </div>

      <section className="glass-panel rounded-3xl p-6">
        <CreateWorldForm />
      </section>
    </main>
  );
}
