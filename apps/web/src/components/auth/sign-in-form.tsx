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
import { signInSchema, type SignInValues } from '@/lib/validation/auth-schemas';

export function SignInForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({ resolver: zodResolver(signInSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await api.signIn(values);
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
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Button
          type="submit"
          variant="cta"
          size="xl"
          className="mt-1 w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </Button>
      </div>
      <p className="mt-4 text-sm">
        <Link href="/forgot-password" className="underline underline-offset-4">
          ลืมรหัสผ่าน?
        </Link>
      </p>
    </form>
  );
}
