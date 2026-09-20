'use client';

import { cn } from 'cn';
import type { ComponentProps, ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * One labelled field with its error. The input is linked to the message with
 * `aria-describedby`, so screen readers announce it (NFR-012).
 */
export function FormField({
  id,
  label,
  error,
  hint,
  className,
  ...inputProps
}: ComponentProps<typeof Input> & {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="font-semibold">
        {label}
      </Label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        // 44px tall, so the field is comfortable to hit on a phone.
        className={cn('h-11 rounded-xl px-3.5', className)}
        {...inputProps}
      />
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
