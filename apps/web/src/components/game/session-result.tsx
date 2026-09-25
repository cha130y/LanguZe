import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import type { SessionSummary } from '@/lib/api/client';
import { PlayActions } from './play-actions';

const MASTERY_TEXT: Record<string, string> = {
  LEARNING: 'กำลังเรียน',
  FAMILIAR: 'เริ่มคุ้น',
  MASTERED: 'จำได้แล้ว',
};

/**
 * The end of a session (FR-035, US-033): how many answers were right, the XP they
 * earned, and the words that moved — the only part of a session that lasts.
 *
 * Words that stayed where they were are not listed. A learner who answered ten
 * mastered words correctly achieved nothing new, and saying otherwise would make
 * the list mean nothing.
 */
export function SessionResult({
  summary,
  worldId,
}: {
  summary: SessionSummary;
  worldId: string | null | undefined;
}) {
  return (
    <section className="grid gap-5">
      <div className="glass-panel grid gap-2 rounded-3xl p-6">
        <h2 className="text-xl font-bold">จบเกมแล้ว</h2>
        <p className="text-sm">
          ตอบถูก {summary.correctCount} จาก {summary.answeredCount} ข้อ
        </p>
        <p className="text-sm font-semibold text-primary">
          ได้รับ {summary.xpEarned} XP
        </p>
      </div>

      <div className="glass-panel grid gap-3 rounded-3xl p-6">
        <h3 className="font-bold">ความคืบหน้าของคำศัพท์</h3>
        {summary.levelChanges.length > 0 ? (
          <ul className="grid gap-2">
            {summary.levelChanges.map((change) => (
              <li
                key={change.english}
                className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
              >
                <span className="font-semibold">{change.english}</span>
                <span className="text-muted-foreground">
                  {MASTERY_TEXT[change.level] ?? change.level}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            รอบนี้ยังไม่มีคำไหนเปลี่ยนระดับ
            ลองเล่นอีกครั้งเพื่อเลื่อนระดับคำศัพท์
          </p>
        )}
      </div>

      {worldId ? (
        <div className="grid gap-3">
          <PlayActions worldId={worldId} openGame={null} />
          <Link
            href={`/worlds/${worldId}`}
            className={buttonVariants({ variant: 'outline', size: 'xl' })}
          >
            กลับไปที่โลกนี้
          </Link>
        </div>
      ) : null}
    </section>
  );
}
