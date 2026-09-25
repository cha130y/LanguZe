import type { World } from './api/client';

/** The reasons the API sends with a `FAILED` world (API design, section 3.3). */
type FailureReason =
  | 'BLOCKED'
  | 'TOO_FEW_WORDS'
  | 'PROVIDER_ERROR'
  | 'INVALID_OUTPUT'
  | 'TIMED_OUT';

interface FailureCopy {
  headline: string;
  advice: string;
}

/**
 * What each failure means and what to do about it (US-021, US-091).
 *
 * The API sends a stable reason in English and the wording lives here, as it does
 * for error codes. The two lines stay together because they have to agree: the
 * headline says what happened, the advice says what to do next, and a reason with
 * only one of them would leave the learner on a page with nowhere to go.
 */
const FAILURES: Record<FailureReason, FailureCopy> = {
  BLOCKED: {
    headline: 'รูปภาพนี้ไม่ผ่านกฎการใช้งาน',
    advice:
      'เราลบรูปนี้ออกจากระบบแล้ว โลกนี้จึงวิเคราะห์ซ้ำไม่ได้ ให้ลบโลกนี้แล้วสร้างใหม่ด้วยรูปอื่น',
  },
  TOO_FEW_WORDS: {
    headline: 'หาคำศัพท์จากรูปนี้ได้น้อยเกินไป',
    advice:
      'โลกหนึ่งต้องมีคำศัพท์อย่างน้อย 3 คำ ลองวิเคราะห์รูปเดิมอีกครั้ง หรือถ่ายรูปใหม่ให้เห็นสิ่งของหลายอย่างชัด ๆ แล้วสร้างโลกใหม่',
  },
  PROVIDER_ERROR: {
    headline: 'ระบบ AI ขัดข้องชั่วคราว',
    advice: 'ไม่ใช่เพราะรูปของคุณ กดวิเคราะห์รูปเดิมอีกครั้งได้เลย',
  },
  INVALID_OUTPUT: {
    headline: 'ผลลัพธ์จาก AI ไม่สมบูรณ์',
    advice: 'ไม่ใช่เพราะรูปของคุณ กดวิเคราะห์รูปเดิมอีกครั้งได้เลย',
  },
  TIMED_OUT: {
    headline: 'การวิเคราะห์ใช้เวลานานเกินไป',
    advice: 'ไม่ใช่เพราะรูปของคุณ กดวิเคราะห์รูปเดิมอีกครั้งได้เลย',
  },
};

/* A reason this release does not know about still has to say something useful. */
const UNKNOWN: FailureCopy = {
  headline: 'วิเคราะห์ไม่สำเร็จ',
  advice: 'ลองวิเคราะห์รูปเดิมอีกครั้ง หรือลบโลกนี้แล้วสร้างใหม่ด้วยรูปอื่น',
};

const failure = (reason: World['failureReason']): FailureCopy =>
  FAILURES[reason as FailureReason] ?? UNKNOWN;

/** One line naming what went wrong, short enough for a badge. */
export const failureHeadline = (reason: World['failureReason']): string =>
  failure(reason).headline;

/** What the learner can do next, which differs for a blocked photo (FR-092). */
export const failureAdvice = (reason: World['failureReason']): string =>
  failure(reason).advice;

/**
 * A failed analysis does not use one of today's ten, except a blocked photo, which
 * does (FR-025, FR-093). Saying which it was is what keeps a learner from being
 * afraid to press retry.
 */
export const countedAgainstLimit = (reason: World['failureReason']): boolean =>
  reason === 'BLOCKED';
