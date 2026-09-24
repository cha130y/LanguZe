import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { WorldCard } from '@/components/worlds/world-card';
import { buttonVariants } from '@/components/ui/button';
import { getAccount, getWorlds } from '@/lib/api/server';

export const metadata: Metadata = { title: 'โลกของฉัน · LanguZe' };

/** Every world the learner has made (US-011). */
export default async function WorldsPage() {
  const [account, worlds] = await Promise.all([getAccount(), getWorlds()]);

  if (!account) redirect('/sign-in');
  if (!account.termsAccepted) redirect('/terms');

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">โลกของฉัน</h1>
        {account.verifiedForAi ? (
          <Link
            href="/worlds/new"
            className={buttonVariants({ variant: 'cta', size: 'xl' })}
          >
            สร้างโลกใหม่
          </Link>
        ) : null}
      </div>

      {/* An unverified learner cannot analyse a photo yet, so say that first (FR-006). */}
      {!account.verifiedForAi ? (
        <section className="glass-panel grid gap-2 rounded-3xl p-6">
          <h2 className="font-bold">ยืนยันอีเมลก่อนสร้างโลก</h2>
          <p className="text-sm text-muted-foreground">
            การวิเคราะห์รูปภาพเป็นฟีเจอร์ AI จึงต้องยืนยันอีเมลก่อน
            เราส่งลิงก์ยืนยันไปให้แล้ว และขอใหม่ได้ที่หน้าแรก
          </p>
          <Link
            href="/"
            className={`${buttonVariants({ variant: 'outline', size: 'lg' })} mt-2 justify-self-start`}
          >
            ไปหน้าแรก
          </Link>
        </section>
      ) : worlds && worlds.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {worlds.map((world) => (
            <WorldCard key={world.id} world={world} />
          ))}
        </div>
      ) : (
        <section className="glass-panel grid gap-2 rounded-3xl p-6">
          <h2 className="font-bold">ยังไม่มีโลกของคุณ</h2>
          <p className="text-sm text-muted-foreground">
            ถ่ายรูปสิ่งรอบตัว เช่น ห้องครัวหรือโต๊ะทำงาน แล้ว LanguZe
            จะหาคำศัพท์ภาษาอังกฤษจากรูปนั้นให้คุณฝึก
          </p>
          <Link
            href="/worlds/new"
            className={`${buttonVariants({ variant: 'cta', size: 'xl' })} mt-2 justify-self-start`}
          >
            สร้างโลกแรกของคุณ
          </Link>
        </section>
      )}
    </main>
  );
}
