'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormAlert } from '@/components/auth/form-alert';
import { FormField } from '@/components/auth/form-field';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api/client';
import { messageForError } from '@/lib/api/error-messages';
import {
  signUpSchema,
  type SignUpInput,
  type SignUpValues,
} from '@/lib/validation/auth-schemas';

export function SignUpForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    // The form reads a year as text and the schema turns it into a number, so the
    // values reaching `onSubmit` are the checked ones, not what the input held.
  } = useForm<SignUpInput, unknown, SignUpValues>({
    resolver: zodResolver(signUpSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await api.signUp(values);
      router.push('/');
      router.refresh();
    } catch (error) {
      setFormError(messageForError(error));
    }
  });

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
        <FormField
          id="email"
          label="อีเมล"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <FormField
          id="password"
          label="รหัสผ่าน"
          type="password"
          autoComplete="new-password"
          hint="อย่างน้อย 8 ตัวอักษร"
          error={errors.password?.message}
          {...register('password')}
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
        <div className="grid gap-1.5">
          <Label htmlFor="acceptTerms" className="items-start gap-2">
            <input
              id="acceptTerms"
              type="checkbox"
              className="mt-0.5 size-4 rounded border-input"
              aria-invalid={errors.acceptTerms ? true : undefined}
              aria-describedby={
                errors.acceptTerms ? 'acceptTerms-error' : undefined
              }
              {...register('acceptTerms')}
            />
            <span className="text-sm font-normal">
              ฉันยอมรับ{' '}
              <Link href="/terms" className="underline underline-offset-4">
                ข้อกำหนดการใช้งาน
              </Link>{' '}
              และ{' '}
              <Link href="/privacy" className="underline underline-offset-4">
                นโยบายความเป็นส่วนตัว
              </Link>
            </span>
          </Label>
          {errors.acceptTerms ? (
            <p
              id="acceptTerms-error"
              role="alert"
              className="text-xs text-destructive"
            >
              {errors.acceptTerms.message}
            </p>
          ) : null}
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'กำลังสมัคร…' : 'สมัครใช้งาน'}
        </Button>
      </div>
    </form>
  );
}
