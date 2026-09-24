import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { WorldActions } from '@/components/worlds/world-actions';
import { WorldStatusBadge } from '@/components/worlds/world-status-badge';
import { getAccount, getWorld } from '@/lib/api/server';

export const metadata: Metadata = { title: 'โลกของฉัน · LanguZe' };

/**
 * One world: its photo, its status, and what can be done with it (US-012).
 * Its words arrive with the analysis increment.
 */
export default async function WorldPage({
  params,
}: {
  params: Promise<{ worldId: string }>;
}) {
  const [{ worldId }, account] = await Promise.all([params, getAccount()]);

  if (!account) redirect('/sign-in');
  if (!account.termsAccepted) redirect('/terms');

  // Another learner's world is answered as missing by the API, and shown as missing
  // here, so this page never confirms that it exists (FR-008).
  const world = await getWorld(worldId);
  if (!world) notFound();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <Link
          href="/worlds"
          className="rounded text-sm text-muted-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          ← โลกของฉัน
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">{world.name}</h1>
        <div className="mt-2">
          <WorldStatusBadge
            status={world.status}
            failureReason={world.failureReason}
          />
        </div>
      </div>

      {world.photoUrl ? (
        // The link is signed and expires, so Next's image optimisation is not used:
        // it would cache a photo that only this learner may see (P4, NFR-008).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={world.photoUrl}
          alt={`รูปภาพของ ${world.name}`}
          className="w-full rounded-3xl object-cover"
        />
      ) : (
        <div className="glass-panel grid min-h-40 place-items-center rounded-3xl p-6 text-sm text-muted-foreground">
          ไม่มีรูปภาพของโลกนี้แล้ว
        </div>
      )}

      <section className="glass-panel grid gap-3 rounded-3xl p-6">
        <h2 className="font-bold">คำศัพท์</h2>
        <p className="text-sm text-muted-foreground">
          {world.wordCount > 0
            ? `${world.wordCount} คำ · จำได้แล้ว ${world.masteredCount} คำ`
            : 'ยังไม่มีคำศัพท์สำหรับโลกนี้'}
        </p>
      </section>

      <section className="glass-panel grid gap-4 rounded-3xl p-6">
        <h2 className="font-bold">จัดการโลกนี้</h2>
        <WorldActions world={world} />
      </section>
    </main>
  );
}
