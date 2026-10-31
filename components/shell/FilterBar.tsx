'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { QUARTERS, REGIONS, filterToQuery } from '@/lib/filters';
import type { Filter, Subregion } from '@/lib/types';


/**
 * Apple segmented control for the quarter (sliding thumb) and pill toggles for the sub-regions.
 * State lives in the URL (?q=&r=) of the current page; every other parameter (compare ?c=, Log search) is carried over.
 * A details page keeps its path and restarts its carousel at the latest slide (`s` dropped).
 */
export function FilterBar({ filter }: { filter: Filter }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const go = (next: Filter) => {
    // Overwrite quarter, regions and type only; the page's own state (compare ?c=, the Log's search and filters) stays.
    // A carousel slide (?s=) belongs to the old filter and restarts at the latest.
    const sp = new URLSearchParams(window.location.search);
    for (const k of ['q', 'r', 't', 's']) sp.delete(k);
    const rest = sp.toString();
    start(() => router.push(`${pathname}?${filterToQuery(next)}${rest ? `&${rest}` : ''}`, { scroll: false }));
  };
  const toggleRegion = (r: Subregion) => {
    const on = filter.regions.includes(r);
    go({ ...filter, regions: REGIONS.filter((x) => (x === r ? !on : filter.regions.includes(x))) });
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 transition-opacity" aria-busy={pending} style={{ opacity: pending ? 0.7 : 1 }}>
      <div role="group" aria-label="Quarter" className="flex h-8 items-center gap-[clamp(10px,1.1vw,20px)]">
        {([...QUARTERS, 'all'] as Filter['quarter'][]).map((q) => {
          const on = filter.quarter === q;
          return (
            <button
              key={q}
              type="button"
              aria-pressed={on}
              onClick={() => go({ ...filter, quarter: q })}
              className="tab h-8 whitespace-nowrap text-[13px]"
            >
              <span className="tab-label">{q === 'all' ? 'All' : q.replace('-', ' ')}</span>
            </button>
          );
        })}
      </div>
      <div role="group" aria-label="Sub-region" className="flex h-8 items-center gap-[clamp(10px,1.1vw,20px)] border-l border-[var(--border)] pl-[clamp(10px,1.1vw,20px)]">
        {REGIONS.map((r) => {
          const on = filter.regions.includes(r);
          return (
            <button
              key={r}
              type="button"
              aria-pressed={on}
              onClick={() => toggleRegion(r)}
              className="tab h-8 text-[13px]"
            >
              <span className="tab-label">{r}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
