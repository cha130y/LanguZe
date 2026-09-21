'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormAlert } from '@/components/auth/form-alert';
import { FormField } from '@/components/auth/form-field';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/client';
import { messageForError } from '@/lib/api/error-messages';
import {
  acceptTermsSchema,
  type AcceptTermsInput,
  type AcceptTermsValues,
} from '@/lib/validation/auth-schemas';

/**
 * The one-time step a provider sign-up finishes before the account can be used
 * (FR-090, V20). The display name arrives from the provider profile and the learner
 * confirms it; the year of birth is asked here because no provider supplies it.
 */
export function TermsForm({ suggestedName }: { suggestedName: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AcceptTermsInput, unknown, AcceptTermsValues>({
    resolver: zodResolver(acceptTermsSchema),
    defaultValues: { name: suggestedName },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await api.acceptTerms(values);
      router.push('/');
      router.refresh();
    } catch (error) {
      setFormError(messageForError(error));
    }
  });

  // Declining removes the pending account entirely, so it is worth confirming.
  const decline = async () => {
    if (!window.confirm('ยกเลิกการสมัครและลบข้อมูลที่กรอกไว้ใช่หรือไม่?')) {
      return;
    }
    setDeclining(true);
    setFormError(null);
    try {
      await api.declineTerms();
      router.push('/');
      router.refresh();
    } catch (error) {
      setFormError(messageForError(error));
      setDeclining(false);
    }
  };

  const busy = isSubmitting || declining;

  return (
    <form onSubmit={onSubmit} noValidate>
      {formError ? <FormAlert>{formError}</FormAlert> : null}
      <div className="grid gap-4">
        <FormField
          id="name"
          label="ชื่อที่ใช้แสดง"
          autoComplete="nickname"
          error={errors.name?.message}
          {...register('name')}
        />
        {/* A neutral question, not "are you 18?", so the answer is more honest (V20). */}
        <FormField
          id="birthYear"
          label="ปีเกิด (ค.ศ.)"
          type="number"
          inputMode="numeric"
          placeholder="เช่น 1998"
          error={errors.birthYear?.message}
          {...register('birthYear')}
        />

        <p className="text-sm text-muted-foreground">
          การกดปุ่มด้านล่างถือว่าคุณยอมรับ{' '}
          <Link href="/terms-of-use" className="underline underline-offset-4">
            ข้อกำหนดการใช้งาน
          </Link>{' '}
          และ{' '}
          <Link href="/privacy" className="underline underline-offset-4">
            นโยบายความเป็นส่วนตัว
          </Link>
        </p>

        <Button
          type="submit"
          variant="cta"
          size="xl"
          className="mt-1 w-full"
          disabled={busy}
        >
          {isSubmitting ? 'กำลังดำเนินการ…' : 'ยอมรับและเริ่มใช้งาน'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={() => void decline()}
          disabled={busy}
        >
          {declining ? 'กำลังยกเลิก…' : 'ไม่ยอมรับ'}
        </Button>
      </div>
    </form>
  );
}
