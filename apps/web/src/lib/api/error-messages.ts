import { ApiError } from './client';

/**
 * Thai text for each error code (API design, E2; NFR-013). The API sends stable codes
 * in English; the wording lives here, so it can change without an API release.
 */
const MESSAGES: Record<string, string> = {
  VALIDATION_FAILED: 'ข้อมูลที่กรอกยังไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง',
  TERMS_NOT_ACCEPTED:
    'กรุณายอมรับข้อกำหนดการใช้งานและนโยบายความเป็นส่วนตัวก่อน',
  MESSAGE_TOO_LONG: 'ข้อความยาวเกินไป',
  NOT_SIGNED_IN: 'กรุณาเข้าสู่ระบบก่อน',
  INVALID_CREDENTIALS: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  ACCOUNT_SUSPENDED: 'บัญชีนี้ถูกระงับการใช้งาน หากมีข้อสงสัยกรุณาติดต่อเรา',
  AGE_BELOW_MINIMUM: 'ขออภัย LanguZe สำหรับผู้ที่มีอายุ 18 ปีขึ้นไปเท่านั้น',
  NOT_VERIFIED: 'กรุณายืนยันอีเมลก่อนใช้ฟีเจอร์ AI',
  AI_SUSPENDED: 'ฟีเจอร์ AI ของบัญชีนี้ถูกพักไว้ชั่วคราว',
  INVALID_TOKEN: 'ลิงก์นี้หมดอายุหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่',
  EMAIL_ALREADY_REGISTERED:
    'อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบหรือตั้งรหัสผ่านใหม่',
  RATE_LIMITED: 'มีการพยายามหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่',
  WORLD_LIMIT_REACHED:
    'คุณมีโลกครบ 20 แห่งแล้ว ลบโลกที่ไม่ใช้แล้วเพื่อเพิ่มโลกใหม่',
  DAILY_ANALYSIS_LIMIT:
    'วันนี้คุณใช้การวิเคราะห์รูปภาพครบแล้ว ระบบจะเริ่มนับใหม่เที่ยงคืนตามเวลาไทย',
  RETRY_NOT_AVAILABLE:
    'โลกนี้วิเคราะห์ซ้ำไม่ได้แล้ว หากไม่ต้องการโลกนี้ ให้ลบแล้วสร้างใหม่ด้วยรูปอื่น',
  LAST_WORD:
    'แต่ละโลกต้องเหลือคำศัพท์อย่างน้อยหนึ่งคำ หากไม่ต้องการโลกนี้แล้ว ให้ลบทั้งโลกแทน',
  NOT_FOUND: 'ไม่พบสิ่งที่คุณเรียกดู อาจถูกลบไปแล้ว',
  WORLD_NOT_READY: 'โลกนี้ยังไม่พร้อมเล่น กรุณารอให้วิเคราะห์เสร็จก่อน',
  SESSION_CLOSED: 'เกมนี้ปิดไปแล้ว กรุณาเริ่มเกมใหม่',
  NOTHING_TO_REVIEW:
    'ยังไม่มีคำศัพท์ให้ทบทวน ลองเล่นเกมในโลกของคุณก่อน แล้วคำที่ยังจำไม่ได้จะกลับมาให้ทบทวน',
  QUESTION_UNAVAILABLE: 'คำนี้ถูกลบออกจากโลกไปแล้ว จึงข้ามข้อนี้ไป',
  PHOTO_TOO_LARGE: 'รูปภาพใหญ่เกิน 10 MB กรุณาเลือกรูปที่เล็กลง',
  PHOTO_TYPE_NOT_ALLOWED: 'รองรับเฉพาะรูปภาพแบบ JPEG, PNG หรือ WebP เท่านั้น',
  SERVICE_UNAVAILABLE: 'ระบบไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่ภายหลัง',
  AI_PROVIDER_UNAVAILABLE:
    'ระบบ AI ไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่อีกครั้ง',
  NETWORK_ERROR:
    'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่',
};

const FALLBACK = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';

/** Thai text for anything thrown by the API client. */
export function messageForError(error: unknown): string {
  if (error instanceof ApiError) return MESSAGES[error.code] ?? FALLBACK;
  return FALLBACK;
}

export const messageForCode = (code: string): string =>
  MESSAGES[code] ?? FALLBACK;
