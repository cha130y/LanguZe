'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormAlert } from '@/components/auth/form-alert';
import { FormField } from '@/components/auth/form-field';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/client';
import { messageForError } from '@/lib/api/error-messages';
import {
  resetPasswordSchema,
  type ResetPasswordValues,
} from '@/lib/validation/auth-schemas';

export function ResetPasswordForm({ token }: { token: string | null }) {
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    if (!token) return;
    setFormError(null);
    try {
      await api.resetPassword(token, values.newPassword);
      setDone(true);
    } catch (error) {
      setFormError(messageForError(error));
    }
  });

  if (!token) {
    return (
      <div>
        <FormAlert>ลิงก์นี้ไม่ถูกต้อง กรุณาขอลิงก์ใหม่อีกครั้ง</FormAlert>
        <Link
          href="/forgot-password"
          className="text-sm underline underline-offset-4"
        >
          ขอลิงก์ใหม่
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div>
        <FormAlert variant="default">
          ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว
          อุปกรณ์อื่นทั้งหมดถูกออกจากระบบเพื่อความปลอดภัย
        </FormAlert>
        <Link href="/sign-in" className="text-sm underline underline-offset-4">
          เข้าสู่ระบบด้วยรหัสผ่านใหม่
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {formError ? <FormAlert>{formError}</FormAlert> : null}
      <div className="grid gap-4">
        <FormField
          id="newPassword"
          label="รหัสผ่านใหม่"
          type="password"
          autoComplete="new-password"
          hint="อย่างน้อย 8 ตัวอักษร"
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <FormField
          id="confirmPassword"
          label="ยืนยันรหัสผ่านใหม่"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'กำลังบันทึก…' : 'ตั้งรหัสผ่านใหม่'}
        </Button>
      </div>
    </form>
  );
}
