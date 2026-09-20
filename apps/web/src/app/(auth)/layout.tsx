import Link from 'next/link';
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-7 px-4 py-10">
      <Link
        href="/"
        className="rounded-lg text-xl font-extrabold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="bg-linear-to-r from-primary to-highlight bg-clip-text text-transparent">
          LanguZe
        </span>
      </Link>
      {children}
    </main>
  );
}
