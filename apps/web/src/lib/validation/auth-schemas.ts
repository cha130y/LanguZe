import { z } from 'zod';

/**
 * Form rules that mirror the API's own (SRS V2, V12, V19, V20). They give quick feedback
 * while typing; the API always checks again, because the browser can be bypassed.
 */
export const MINIMUM_AGE = 18;
const MIN_PASSWORD_LENGTH = 8;
const EARLIEST_BIRTH_YEAR = 1900;

const email = z.email({ error: 'กรุณากรอกอีเมลให้ถูกต้อง' }).max(254);
const password = z
  .string()
  .min(MIN_PASSWORD_LENGTH, {
    error: `รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`,
  })
  .max(128);

export const signUpSchema = z.object({
  email,
  password,
  name: z
    .string()
    .trim()
    .min(1, { error: 'กรุณากรอกชื่อที่ใช้แสดง' })
    .max(50, { error: 'ชื่อที่ใช้แสดงต้องไม่เกิน 50 ตัวอักษร' }),
  birthYear: z.coerce
    .number({ error: 'กรุณากรอกปีเกิด (ค.ศ.)' })
    .int({ error: 'กรุณากรอกปีเกิดเป็นตัวเลข' })
    .min(EARLIEST_BIRTH_YEAR, { error: 'กรุณากรอกปีเกิดให้ถูกต้อง' })
    .max(new Date().getFullYear(), { error: 'กรุณากรอกปีเกิดให้ถูกต้อง' }),
  acceptTerms: z.literal(true, {
    error: 'กรุณายอมรับข้อกำหนดการใช้งานและนโยบายความเป็นส่วนตัว',
  }),
});

export const signInSchema = z.object({
  email,
  password: z.string().min(1, { error: 'กรุณากรอกรหัสผ่าน' }),
});

export const emailOnlySchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    error: 'รหัสผ่านทั้งสองช่องไม่ตรงกัน',
    path: ['confirmPassword'],
  });

/** What the form holds while typing: `birthYear` is still the text from the input. */
export type SignUpInput = z.input<typeof signUpSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
export type SignInValues = z.infer<typeof signInSchema>;
export type EmailOnlyValues = z.infer<typeof emailOnlySchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
