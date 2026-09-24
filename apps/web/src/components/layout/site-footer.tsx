import Link from 'next/link';

/** Every page links to the rules and to a way of reaching LanguZe (US-090, FR-099). */
export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 px-4 py-6">
      <nav
        aria-label="ข้อมูลทางกฎหมาย"
        className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground"
      >
        <Link
          href="/terms-of-use"
          className="rounded underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          ข้อกำหนดการใช้งาน
        </Link>
        <Link
          href="/privacy-policy"
          className="rounded underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          นโยบายความเป็นส่วนตัว
        </Link>
        <Link
          href="/contact"
          className="rounded underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          ติดต่อเรา
        </Link>
      </nav>
    </footer>
  );
}
