import Link from 'next/link';
import { RotateCcw } from 'lucide-react';

/** Whole-hero empty state: no audits match the filter. One line and one action, no NaN anywhere. */
export function EmptyState() {
  return (
    <section
      data-testid="empty-state"
      aria-labelledby="empty-title"
      className="col-span-full flex flex-1 flex-col items-center justify-center gap-6 text-center"
    >
      <p className="figure text-[clamp(96px,18svh,180px)] text-faint" aria-hidden>0</p>
      <h2 id="empty-title" className="text-[21px] font-semibold tracking-[-0.02em]">No audits match this filter</h2>
      <Link
        href="/"
        className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-[14px] font-semibold text-ground transition-transform motion-safe:active:scale-[0.97]"
      >
        <RotateCcw size={15} aria-hidden />
        Show all audits
      </Link>
    </section>
  );
}
