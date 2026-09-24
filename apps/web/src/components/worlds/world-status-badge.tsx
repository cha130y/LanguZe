import type { World } from '@/lib/api/client';

/** What each failure means for the learner (API design, section 3.3). */
const FAILURE_TEXT: Record<string, string> = {
  BLOCKED: 'รูปภาพนี้ไม่ผ่านกฎการใช้งาน',
  TOO_FEW_WORDS: 'หาคำศัพท์จากรูปนี้ได้น้อยเกินไป',
  PROVIDER_ERROR: 'ระบบ AI ขัดข้องชั่วคราว',
  INVALID_OUTPUT: 'ผลลัพธ์จาก AI ไม่สมบูรณ์',
  TIMED_OUT: 'ใช้เวลานานเกินไป',
};

/** The world's analysis status, in words a learner can act on (FR-013, FR-021). */
export function WorldStatusBadge({
  status,
  failureReason,
}: {
  status: World['status'];
  failureReason: World['failureReason'];
}) {
  if (status === 'ANALYZING') {
    return (
      <p className="glass-pill w-fit rounded-full px-3 py-1 text-xs font-semibold">
        กำลังวิเคราะห์…
      </p>
    );
  }

  if (status === 'FAILED') {
    return (
      <p className="w-fit rounded-full bg-destructive/15 px-3 py-1 text-xs font-semibold text-destructive">
        {(failureReason && FAILURE_TEXT[failureReason]) ?? 'วิเคราะห์ไม่สำเร็จ'}
      </p>
    );
  }

  return (
    <p className="w-fit rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
      พร้อมเล่น
    </p>
  );
}
