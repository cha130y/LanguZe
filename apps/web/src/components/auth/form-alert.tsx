'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';

/** A message about the whole form, such as a refused sign-in. */
export function FormAlert({
  children,
  variant = 'destructive',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'destructive';
}) {
  return (
    <Alert variant={variant} className="mb-4">
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
