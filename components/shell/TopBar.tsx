import type { Filter } from '@/lib/types';
import { FilterBar } from './FilterBar';
import { ThemeToggle } from './ThemeToggle';

/** Product mark: a hard-hat brim under a three-quarter score arc, drawn in ink. */
function Mark() {
  return (
    <svg width="24" height="24" viewBox="0 0 28 28" aria-hidden className="shrink-0">
      <path d="M5 19a9 9 0 1 1 18 0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="2" y="20.5" width="24" height="3" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export function TopBar({ filter }: { filter: Filter }) {
  return (
    <header className="flex min-h-[var(--topbar)] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-[var(--gutter)] py-2 min-[1200px]:h-[var(--topbar)] min-[1200px]:py-0">
      <div className="flex min-w-0 items-center gap-3">
        <Mark />
        <h1 className="truncate font-display text-[26px] leading-none tracking-[-0.01em]">HSE Audits</h1>
      </div>
      <div className="flex flex-wrap items-center gap-x-7 gap-y-2">
        <FilterBar filter={filter} />
        <ThemeToggle />
      </div>
    </header>
  );
}
