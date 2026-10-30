'use client';
import { motion } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { QUARTERS, REGIONS, filterToQuery } from '@/lib/filters';
import type { Filter, Subregion } from '@/lib/types';
import { EASE, DUR } from '@/lib/motion';


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
      <div role="group" aria-label="Quarter" className="flex h-8 items-center rounded-full bg-fill p-[2px]">
        {([...QUARTERS, 'all'] as Filter['quarter'][]).map((q) => {
          const on = filter.quarter === q;
          return (
            <button
              key={q}
              type="button"
              aria-pressed={on}
              onClick={() => go({ ...filter, quarter: q })}
              className={`relative h-7 rounded-full px-3.5 text-[13px] transition-colors ${on ? 'font-semibold text-ink' : 'text-muted hover:text-ink'}`}
            >
              {on && (
                <motion.span
                  layoutId="quarter-thumb"
                  className="absolute inset-0 rounded-full bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.04)] dark:bg-[#636366]"
                  transition={{ type: 'tween', ease: EASE, duration: DUR }}
                />
              )}
              <span className="relative">{q === 'all' ? 'All' : q.replace('-', ' ')}</span>
            </button>
          );
        })}
      </div>
      <div role="group" aria-label="Sub-region" className="flex items-center gap-1.5">
        {REGIONS.map((r) => {
          const on = filter.regions.includes(r);
          return (
            <button
              key={r}
              type="button"
              aria-pressed={on}
              onClick={() => toggleRegion(r)}
              className={`h-8 rounded-full px-3.5 text-[13px] transition-[background-color,color,transform] active:scale-95 ${
                on ? 'bg-ink font-semibold text-ground' : 'bg-fill text-muted hover:text-ink'
              }`}
            >
              {r}
            </button>
          );
        })}
      </div>
    </div>
  );
}
