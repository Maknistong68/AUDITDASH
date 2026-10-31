import Link from 'next/link';

/** Unknown contractor, category, item or observation. */
export default function NotFound() {
  return (
    <main id="main" data-testid="not-found" className="flex min-h-svh flex-col items-center justify-center gap-6 px-[var(--gutter)] text-center">
      <p className="figure text-[clamp(96px,18svh,180px)] text-faint" aria-hidden>404</p>
      <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Nothing here</h1>
      <Link href="/" className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-[14px] font-semibold text-ground">Back to overview</Link>
    </main>
  );
}
