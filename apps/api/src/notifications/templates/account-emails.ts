import type { MailMessage } from '../mail-sender.js';

/**
 * Account emails, in Thai like the rest of the interface (NFR-013).
 * Links point at the web app, which then calls the API with the token.
 */

function layout(
  heading: string,
  lines: string[],
  action: { label: string; url: string },
): string {
  const paragraphs = lines.map((line) => `<p>${line}</p>`).join('');
  return `<div style="font-family:sans-serif;line-height:1.6">
<h1 style="font-size:20px">${heading}</h1>
${paragraphs}
<p><a href="${action.url}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;border-radius:8px;text-decoration:none">${action.label}</a></p>
<p style="font-size:12px;color:#555">หากปุ่มใช้งานไม่ได้ ให้คัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:<br>${action.url}</p>
</div>`;
}

export function verificationEmail(to: string, url: string): MailMessage {
  const heading = 'ยืนยันอีเมลของคุณ';
  const lines = [
    'ขอบคุณที่สมัครใช้งาน LanguZe',
    'กดปุ่มด้านล่างเพื่อยืนยันอีเมล แล้วคุณจะใช้การวิเคราะห์รูปภาพและติวเตอร์ AI ได้',
    'ลิงก์นี้ใช้ได้ครั้งเดียว หากคุณไม่ได้สมัครใช้งาน ให้ละเว้นอีเมลฉบับนี้',
  ];
  return {
    to,
    subject: 'ยืนยันอีเมลของคุณ · LanguZe',
    text: `${lines.join('\n\n')}\n\n${url}`,
    html: layout(heading, lines, { label: 'ยืนยันอีเมล', url }),
  };
}

export function passwordResetEmail(to: string, url: string): MailMessage {
  const heading = 'ตั้งรหัสผ่านใหม่';
  const lines = [
    'เราได้รับคำขอตั้งรหัสผ่านใหม่สำหรับบัญชี LanguZe ของคุณ',
    'กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ เมื่อตั้งเสร็จแล้ว อุปกรณ์ทั้งหมดจะต้องเข้าสู่ระบบใหม่',
    'ลิงก์นี้ใช้ได้ครั้งเดียว หากคุณไม่ได้ขอ ให้ละเว้นอีเมลฉบับนี้ รหัสผ่านเดิมจะยังใช้ได้ตามปกติ',
  ];
  return {
    to,
    subject: 'ตั้งรหัสผ่านใหม่ · LanguZe',
    text: `${lines.join('\n\n')}\n\n${url}`,
    html: layout(heading, lines, { label: 'ตั้งรหัสผ่านใหม่', url }),
  };
}
