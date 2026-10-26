import Link from 'next/link';
import { RotateCcw, SearchX } from 'lucide-react';

/** Whole-hero empty state: no audits match the filter. Keeps the frame; one line and one action. */
export function EmptyState() {
  return (
    <section data-testid="empty-state" className="panel col-span-full flex flex-col items-center justify-center gap-4 p-8 text-center">
      <SearchX size={40} strokeWidth={1.5} className="text-muted" aria-hidden />
      <h2 className="text-[20px] font-semibold">No audits match this filter</h2>
      <Link
        href="/"
        className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-control)] bg-ink px-4 text-[14px] font-medium text-surface transition-transform active:scale-[0.97]"
      >
        <RotateCcw size={15} aria-hidden />
        Show all audits
      </Link>
    </section>
  );
}
