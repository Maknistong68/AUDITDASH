import Link from 'next/link';
import { filterToQuery } from '@/lib/filters';
import type { Filter } from '@/lib/types';
import { FilterBar } from './FilterBar';
import { NewAuditButton } from './NewAuditButton';
import { ThemeToggle } from './ThemeToggle';
import { TopBarHeight } from './TopBarHeight';
import { TypeTabs } from './TypeTabs';

/** Product mark: a hard-hat brim under a three-quarter score arc. */
function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 28 28" aria-hidden className="shrink-0">
      <path d="M5 19a9 9 0 1 1 18 0" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <rect x="2" y="20.5" width="24" height="3" rx="1.5" fill="currentColor" />
    </svg>
  );
}

/**
 * Frosted sticky bar, one row from 1200px: wordmark + audit-type tabs on the left; quarter, regions,
 * + New Audit and the theme switch on the right. On details pages (`detail`) the wordmark links home
 * and the page's own title takes the h1.
 */
export function TopBar({ filter, detail = false }: { filter: Filter; detail?: boolean }) {
  const word = 'truncate text-[21px] font-semibold leading-none tracking-[-0.025em] whitespace-nowrap';
  return (
    <header data-testid="topbar" className="glass-bar sticky top-0 z-30 flex print:hidden min-h-[var(--topbar)] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-[var(--gutter)] py-2 min-[1200px]:h-[var(--topbar)] min-[1200px]:flex-nowrap min-[1200px]:py-0">
      <div className="flex min-w-0 flex-wrap items-center gap-x-[clamp(16px,1.8vw,32px)] gap-y-2 min-[1200px]:flex-nowrap">
        {detail ? (
          <Link href={`/?${filterToQuery(filter)}`} className="flex shrink-0 items-center gap-2.5 rounded-lg" aria-label="Audits Only overview">
            <Mark />
            <span className={word}>Audits Only</span>
          </Link>
        ) : (
          <div className="flex shrink-0 items-center gap-2.5">
            <Mark />
            <h1 className={word}>Audits Only</h1>
          </div>
        )}
        <TypeTabs filter={filter} />
      </div>
      <div className="flex flex-wrap items-center gap-x-[clamp(10px,1.1vw,20px)] gap-y-2 min-[1200px]:flex-nowrap">
        <FilterBar filter={filter} />
        <NewAuditButton type={filter.type} />
        <ThemeToggle />
      </div>
      <TopBarHeight />
    </header>
  );
}
