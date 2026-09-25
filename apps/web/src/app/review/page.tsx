import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PlayActions } from '@/components/game/play-actions';
import { buttonVariants } from '@/components/ui/button';
import { getAccount, getCurrentReview, getProgress } from '@/lib/api/server';

export const metadata: Metadata = { title: 'ทบทวน · LanguZe' };

/**
 * Review: the words the learner is losing, from every world at once (US-050).
 *
 * Whether there is anything to review is worked out before the learner presses
 * anything (US-051), from the words that stand at a level between new and
 * mastered — which is exactly the set review draws from (FR-050). Offering a
 * button that could only refuse would be a poor welcome for a new learner, whose
 * first visit here is the likeliest to have nothing behind it.
 *
 * The count can still be wrong in one direction: a word can stand at a level and
 * have no photo left to show it in. Starting anyway says so rather than failing,
 * so both paths end up at the same explanation.
 */
export default async function ReviewPage() {
  const [account, openReview, progress] = await Promise.all([
    getAccount(),
    getCurrentReview(),
    getProgress(),
  ]);

  if (!account) redirect('/sign-in');
  if (!account.termsAccepted) redirect('/terms');

  const waiting = progress
    ? progress.words.LEARNING + progress.words.FAMILIAR
    : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <Link
          href="/"
          className="rounded text-sm text-muted-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          ← หน้าแรก
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">ทบทวน</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          รวมคำที่คุณยังจำไม่แม่นจากทุกโลก มาให้ทบทวนพร้อมกัน
        </p>
      </div>

      {/* FR-053: with nothing to bring back, say so and point somewhere useful. */}
      {!openReview && waiting === 0 ? (
        <section className="glass-panel grid gap-2 rounded-3xl p-6">
          <h2 className="font-bold">ยังไม่มีอะไรให้ทบทวน</h2>
          <p className="text-sm text-muted-foreground">
            การทบทวนจะรวมคำที่คุณเคยตอบมาแล้วแต่ยังจำไม่แม่น
            ลองเล่นเกมในโลกของคุณสักรอบก่อน แล้วคำที่ยังไม่แม่นจะมารออยู่ที่นี่
          </p>
          <Link
            href="/worlds"
            className={`${buttonVariants({ variant: 'cta', size: 'xl' })} mt-2 justify-self-start`}
          >
            ไปเล่นเกมในโลกของฉัน
          </Link>
        </section>
      ) : (
        <section className="glass-panel grid gap-4 rounded-3xl p-6">
          {waiting !== null && !openReview ? (
            <p className="text-sm text-muted-foreground">
              ตอนนี้มีคำที่ยังจำไม่แม่นอยู่ {waiting} คำ
            </p>
          ) : null}
          <PlayActions kind="REVIEW" openSession={openReview} />
        </section>
      )}
    </main>
  );
}
