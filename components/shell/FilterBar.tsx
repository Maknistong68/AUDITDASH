'use client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { QUARTERS, REGIONS, filterToQuery } from '@/lib/filters';
import type { Filter, Subregion } from '@/lib/types';

const QUARTER_LABEL: Record<Filter['quarter'], string> = { 'Q4-2025': 'Q4 2025', 'Q1-2026': 'Q1 2026', all: 'All' };

/** Quarter switch (text + underline) and region toggles (dot = on). State lives in the URL (?q=&r=). */
export function FilterBar({ filter }: { filter: Filter }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (next: Filter) => start(() => router.push(`/?${filterToQuery(next)}`, { scroll: false }));
  const toggleRegion = (r: Subregion) => {
    const on = filter.regions.includes(r);
    go({ ...filter, regions: REGIONS.filter((x) => (x === r ? !on : filter.regions.includes(x))) });
  };

  return (
    <div className="flex flex-wrap items-center gap-x-7 gap-y-2" aria-busy={pending}>
      <div role="group" aria-label="Quarter" className="flex items-center gap-5">
        {([...QUARTERS, 'all'] as Filter['quarter'][]).map((q) => {
          const on = filter.quarter === q;
          return (
            <button
              key={q}
              type="button"
              aria-pressed={on}
              onClick={() => go({ ...filter, quarter: q })}
              className={`relative h-9 text-[14px] transition-colors after:absolute after:inset-x-0 after:bottom-1 after:h-[1.5px] after:origin-left after:bg-ink after:transition-transform after:duration-300 motion-reduce:after:transition-none ${
                on ? 'font-medium text-ink after:scale-x-100' : 'text-muted after:scale-x-0 hover:text-ink'
              }`}
            >
              {QUARTER_LABEL[q]}
            </button>
          );
        })}
      </div>
      <div role="group" aria-label="Sub-region" className="flex items-center gap-4">
        {REGIONS.map((r) => {
          const on = filter.regions.includes(r);
          return (
            <button
              key={r}
              type="button"
              aria-pressed={on}
              onClick={() => toggleRegion(r)}
              className={`flex h-9 items-center gap-2 text-[14px] transition-colors ${on ? 'font-medium text-ink' : 'text-muted hover:text-ink'}`}
            >
              <span
                aria-hidden
                className={`size-2 rounded-full border transition-colors ${on ? 'border-ink bg-ink' : 'border-faint bg-transparent'}`}
              />
              {r}
            </button>
          );
        })}
      </div>
    </div>
  );
}
