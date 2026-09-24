import type { Metadata } from 'next';
import Link from 'next/link';
import { CONTACT_EMAIL, LAST_UPDATED } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'ติดต่อเรา · LanguZe',
  description:
    'ที่อยู่อีเมลสำหรับรายงานปัญหา อุทธรณ์ และคำขอเรื่องข้อมูลส่วนบุคคล',
};

export default function ContactPage() {
  return (
    <>
      <h1>ติดต่อเรา</h1>
      <p className="text-sm text-muted-foreground">
        ปรับปรุงล่าสุด {LAST_UPDATED}
      </p>

      <p>
        ส่งอีเมลมาที่{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold">
          {CONTACT_EMAIL}
        </a>{' '}
        เราอ่านทุกฉบับและจะตอบกลับโดยเร็วที่สุด
      </p>

      <h2>เรื่องที่ติดต่อได้</h2>
      <ul>
        <li>
          <strong>รายงานการใช้งานที่ไม่เหมาะสม</strong> — เนื้อหาหรือพฤติกรรม
          ที่ขัดกับ <Link href="/terms-of-use">ข้อกำหนดการใช้งาน</Link>
        </li>
        <li>
          <strong>อุทธรณ์การระงับฟีเจอร์ AI</strong> —
          หากคุณเห็นว่าการระงับไม่ถูกต้อง
        </li>
        <li>
          <strong>คำขอเกี่ยวกับข้อมูลส่วนบุคคล</strong> — ขอเข้าถึง แก้ไข ลบ
          หรือใช้สิทธิอื่นตาม{' '}
          <Link href="/privacy-policy">นโยบายความเป็นส่วนตัว</Link>
        </li>
        <li>
          <strong>ปัญหาการใช้งานและข้อเสนอแนะ</strong>
        </li>
      </ul>

      <h2>สิ่งที่ควรใส่มาในอีเมล</h2>
      <ul>
        <li>
          รหัสบัญชีของคุณ ดูได้ที่หน้า <Link href="/account">บัญชีของฉัน</Link>{' '}
          ซึ่งช่วยให้เราค้นหาบัญชีได้แม้บัญชีนั้นไม่มีอีเมล
        </li>
        <li>สิ่งที่เกิดขึ้น และเวลาโดยประมาณ</li>
        <li>ภาพหน้าจอ หากมี</li>
      </ul>

      <p>เขียนมาเป็นภาษาไทยหรือภาษาอังกฤษก็ได้</p>
    </>
  );
}
