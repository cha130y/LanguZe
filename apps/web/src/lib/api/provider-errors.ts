/**
 * Thai text for a provider sign-in that did not finish (US-004 criterion 7).
 *
 * Better Auth sends the browser back to the sign-in page with `?error=<code>`, its
 * own vocabulary rather than LanguZe's error codes. Anything unrecognised gets the
 * general message: the learner's next step is the same either way, and the codes
 * name internals that mean nothing to them.
 */
const MESSAGES: Record<string, string> = {
  // The learner pressed cancel, or refused the permissions, at the provider.
  access_denied: 'คุณยกเลิกการเข้าสู่ระบบ ลองใหม่ได้ทุกเมื่อ',
  // The sign-in was left too long, or was started in another browser.
  state_not_found: 'การเข้าสู่ระบบหมดเวลา กรุณาเริ่มใหม่อีกครั้ง',
  state_mismatch: 'การเข้าสู่ระบบหมดเวลา กรุณาเริ่มใหม่อีกครั้ง',
};

const GENERAL = 'เข้าสู่ระบบด้วยบัญชีภายนอกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';

/** The message for the `error` query parameter, or nothing when there is none. */
export function messageForProviderError(
  error: string | string[] | undefined,
): string | null {
  const code = Array.isArray(error) ? error[error.length - 1] : error;
  if (!code) return null;
  return MESSAGES[code] ?? GENERAL;
}
