'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/client';
import { messageForError } from '@/lib/api/error-messages';

/**
 * Deleting the account (US-009, FR-007).
 *
 * The first press only opens the warning: deletion is permanent, so it never
 * happens on one press, and cancelling leaves everything as it was (criterion 3).
 * Afterwards the browser goes home and the page is fetched again: the session is
 * gone, so what was the learner's home has to be rebuilt for a visitor.
 */
export function DeleteAccount() {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setDeleting(true);
    setError(null);
    try {
      await api.deleteAccount();
      router.push('/');
      router.refresh();
    } catch (caught) {
      setError(messageForError(caught));
      setDeleting(false);
    }
  };

  return (
    <section className="glass-panel rounded-3xl p-6">
      <h2 className="text-lg font-bold">ลบบัญชี</h2>

      {asking ? (
        <div className="grid gap-4">
          <p className="mt-2 text-sm text-muted-foreground">
            การลบบัญชีจะเอาข้อมูลทั้งหมดของคุณออกอย่างถาวร ทั้งโลก รูปภาพ
            คำศัพท์ ความคืบหน้า แต้ม บทสนทนากับติวเตอร์ และการเข้าสู่ระบบด้วย
            Google หรือ LINE รูปภาพจะถูกลบออกจากที่จัดเก็บภายใน 24 ชั่วโมง
            การลบนี้ย้อนกลับไม่ได้
          </p>

          <div className="grid gap-3 sm:flex">
            <Button
              type="button"
              variant="destructive"
              size="xl"
              className="sm:flex-1"
              onClick={() => void remove()}
              disabled={deleting}
            >
              {deleting ? 'กำลังลบ…' : 'ยืนยันลบบัญชีถาวร'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xl"
              className="sm:flex-1"
              onClick={() => {
                setAsking(false);
                setError(null);
              }}
              disabled={deleting}
            >
              ยกเลิก
            </Button>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4">
          <p className="mt-2 text-sm text-muted-foreground">
            ลบบัญชีและข้อมูลทั้งหมดของคุณออกจาก LanguZe อย่างถาวร
          </p>
          <Button
            type="button"
            variant="destructive"
            size="xl"
            className="justify-self-start"
            onClick={() => setAsking(true)}
          >
            ลบบัญชีของฉัน
          </Button>
        </div>
      )}
    </section>
  );
}
