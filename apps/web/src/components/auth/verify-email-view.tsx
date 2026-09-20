'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { FormAlert } from '@/components/auth/form-alert';
import { api } from '@/lib/api/client';
import { messageForError } from '@/lib/api/error-messages';

type State = 'checking' | 'verified' | 'failed';

/** Opens the link from the verification email and sends its token to the API (US-002). */
export function VerifyEmailView({ token }: { token: string | null }) {
  const [state, setState] = useState<State>(token ? 'checking' : 'failed');
  const [message, setMessage] = useState(
    'ลิงก์นี้ไม่ถูกต้อง กรุณาขอลิงก์ใหม่อีกครั้ง',
  );
  // React runs effects twice in development; the token may only be used once.
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;

    api
      .verifyEmail(token)
      .then(() => setState('verified'))
      .catch((error: unknown) => {
        setMessage(messageForError(error));
        setState('failed');
      });
  }, [token]);

  if (state === 'checking') {
    return <p className="text-sm text-muted-foreground">กำลังยืนยันอีเมล…</p>;
  }

  if (state === 'verified') {
    return (
      <div>
        <FormAlert variant="default">
          ยืนยันอีเมลเรียบร้อยแล้ว ตอนนี้คุณใช้การวิเคราะห์รูปภาพและติวเตอร์ AI
          ได้
        </FormAlert>
        <Link href="/" className="text-sm underline underline-offset-4">
          ไปหน้าแรก
        </Link>
      </div>
    );
  }

  return (
    <div>
      <FormAlert>{message}</FormAlert>
      <Link href="/" className="text-sm underline underline-offset-4">
        ไปหน้าแรก
      </Link>
    </div>
  );
}
