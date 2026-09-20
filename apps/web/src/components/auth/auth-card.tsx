import type { ReactNode } from 'react';

/** The frame every account page shares: a title, a short explanation, and the form. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="glass-panel w-full max-w-sm rounded-3xl p-6 sm:p-7">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-5">{children}</div>
      {footer ? (
        <div className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
