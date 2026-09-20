import type { Metadata } from 'next';
import { IBM_Plex_Sans_Thai_Looped, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const latin = Plus_Jakarta_Sans({
  variable: '--font-latin',
  subsets: ['latin'],
});

/*
 * Thai comes from its own face: Plus Jakarta Sans has no Thai glyphs, so the browser
 * would otherwise fall back to whatever the device happens to have. Looped letterforms
 * are the easier ones to read at small sizes, which matters when the interface is Thai.
 */
const thai = IBM_Plex_Sans_Thai_Looped({
  variable: '--font-thai',
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'LanguZe',
  description: 'Learn from your world.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="th"
      // `dark` is fixed: the interface has no light theme, and the shadcn primitives
      // resolve their `dark:` rules against this class.
      className={`dark ${latin.variable} ${thai.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
