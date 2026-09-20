'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormAlert } from '@/components/auth/form-alert';
import { FormField } from '@/components/auth/form-field';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/client';
import { messageForError } from '@/lib/api/error-messages';
import {
  emailOnlySchema,
  type EmailOnlyValues,
} from '@/lib/validation/auth-schemas';

export function ForgotPasswordForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailOnlyValues>({ resolver: zodResolver(emailOnlySchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await api.requestPasswordReset(values.email);
      setSent(true);
    } catch (error) {
      setFormError(messageForError(error));
    }
  });

  // The same answer whether or not the address has an account (FR-005).
  if (sent) {
    return (
      <FormAlert variant="default">
        หากอีเมลนี้มีบัญชีอยู่ เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้แล้ว
        กรุณาตรวจสอบกล่องจดหมาย
      </FormAlert>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {formError ? <FormAlert>{formError}</FormAlert> : null}
      <div className="grid gap-4">
        <FormField
          id="email"
          label="อีเมล"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'กำลังส่ง…' : 'ส่งลิงก์ตั้งรหัสผ่านใหม่'}
        </Button>
      </div>
    </form>
  );
}
