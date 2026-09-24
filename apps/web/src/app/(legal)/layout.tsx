import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * The frame the Terms of Use, the Privacy Policy and the contact page share
 * (US-090). The text itself is plain HTML in each page; the spacing and sizes are
 * set here, so the pages stay readable prose rather than markup full of classes.
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10">
      <Link
        href="/"
        className="rounded-lg text-xl font-extrabold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="bg-linear-to-r from-primary to-highlight bg-clip-text text-transparent">
          LanguZe
        </span>
      </Link>

      <article className="glass-panel mt-7 w-full max-w-2xl rounded-3xl p-6 leading-7 sm:p-8 [&_a]:underline [&_a]:underline-offset-4 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_li]:mt-1 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:ps-6">
        {children}
      </article>
    </main>
  );
}
