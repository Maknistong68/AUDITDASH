import type { Filter } from '@/lib/types';
import { FilterBar } from './FilterBar';
import { ThemeToggle } from './ThemeToggle';

/** Product mark: a hard-hat brim under a three-quarter score arc, drawn in ink. */
function Mark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden className="shrink-0">
      <path d="M5 19a9 9 0 1 1 18 0" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <rect x="2" y="20" width="24" height="3.5" rx="1.75" fill="currentColor" />
    </svg>
  );
}

export function TopBar({ filter }: { filter: Filter }) {
  return (
    <header className="flex min-h-[var(--topbar)] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 sm:px-6 min-[1200px]:h-[var(--topbar)] min-[1200px]:py-0">
      <div className="flex min-w-0 items-center gap-3">
        <Mark />
        <h1 className="truncate text-[18px] font-semibold tracking-[-0.01em]">HSE Audits</h1>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <FilterBar filter={filter} />
        <span className="hidden h-6 w-px bg-control sm:block" aria-hidden />
        <ThemeToggle />
      </div>
    </header>
  );
}
