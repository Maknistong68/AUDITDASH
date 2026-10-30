import Link from 'next/link';
import { filterToQuery } from '@/lib/filters';
import type { Filter } from '@/lib/types';
import { FilterBar } from './FilterBar';
import { NewAuditButton } from './NewAuditButton';
import { TopBarHeight } from './TopBarHeight';
import { TypeTabs } from './TypeTabs';
import { MainNav } from './MainNav';
import { Suspense } from 'react';

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
          <Link href={`/?${filterToQuery(filter)}`} className="shrink-0 rounded-lg" aria-label="Audits overview">
            <span className={word}>Audits</span>
          </Link>
        ) : (
          <h1 className={`shrink-0 ${word}`}>Audits</h1>
        )}
        <Suspense fallback={null}>
          <MainNav />
        </Suspense>
        <TypeTabs filter={filter} />
      </div>
      <div className="flex flex-wrap items-center gap-x-[clamp(10px,1.1vw,20px)] gap-y-2 min-[1200px]:flex-nowrap">
        <FilterBar filter={filter} />
        <NewAuditButton type={filter.type} />
      </div>
      <TopBarHeight />
    </header>
  );
}
