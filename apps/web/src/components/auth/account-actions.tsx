'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/client';
import { messageForError } from '@/lib/api/error-messages';

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    try {
      await api.signOut();
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" onClick={() => void signOut()} disabled={busy}>
      {busy ? 'กำลังออกจากระบบ…' : 'ออกจากระบบ'}
    </Button>
  );
}

/** Lets an unverified learner ask for the verification email again (US-002, US-008). */
export function ResendVerificationButton({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>(
    'idle',
  );
  const [error, setError] = useState<string | null>(null);

  const resend = async () => {
    setState('sending');
    setError(null);
    try {
      await api.sendVerificationEmail(email);
      setState('sent');
    } catch (caught) {
      setError(messageForError(caught));
      setState('failed');
    }
  };

  if (state === 'sent') {
    return (
      <p className="text-sm">
        ส่งอีเมลยืนยันอีกครั้งแล้ว กรุณาตรวจสอบกล่องจดหมาย
      </p>
    );
  }

  return (
    <div className="grid gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={() => void resend()}
        disabled={state === 'sending'}
      >
        {state === 'sending' ? 'กำลังส่ง…' : 'ส่งอีเมลยืนยันอีกครั้ง'}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
