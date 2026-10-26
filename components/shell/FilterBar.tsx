'use client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Check } from 'lucide-react';
import { QUARTERS, REGIONS, filterToQuery } from '@/lib/filters';
import type { Filter, Subregion } from '@/lib/types';

const QUARTER_LABEL: Record<Filter['quarter'], string> = { 'Q4-2025': 'Q4 2025', 'Q1-2026': 'Q1 2026', all: 'All' };

/** Quarter segmented control + region toggle chips. State lives in the URL (?q=&r=). */
export function FilterBar({ filter }: { filter: Filter }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (next: Filter) => start(() => router.push(`/?${filterToQuery(next)}`, { scroll: false }));
  const toggleRegion = (r: Subregion) => {
    const on = filter.regions.includes(r);
    go({ ...filter, regions: REGIONS.filter((x) => (x === r ? !on : filter.regions.includes(x))) });
  };

  return (
    <div className="flex flex-wrap items-center gap-3" aria-busy={pending}>
      <div role="group" aria-label="Quarter" className="flex h-9 items-center rounded-[var(--radius-control)] bg-raised p-1">
        {([...QUARTERS, 'all'] as Filter['quarter'][]).map((q) => {
          const on = filter.quarter === q;
          return (
            <button
              key={q}
              type="button"
              aria-pressed={on}
              onClick={() => go({ ...filter, quarter: q })}
              className={`h-7 rounded-[5px] px-3 text-[13px] font-medium transition-colors ${
                on ? 'bg-active text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {QUARTER_LABEL[q]}
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
              className={`flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] border px-3 text-[13px] font-medium transition-colors active:scale-[0.97] ${
                on ? 'border-control bg-surface text-ink dark:bg-active' : 'border-dashed border-control text-muted hover:text-ink'
              }`}
            >
              <Check size={14} aria-hidden className={on ? 'opacity-100' : 'opacity-0'} />
              {r}
            </button>
          );
        })}
      </div>
    </div>
  );
}
