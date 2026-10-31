'use client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { AUDIT_TYPES } from '@/lib/auditTypeIds';
import { filterToQuery } from '@/lib/filters';
import type { AuditType, Filter } from '@/lib/types';

/**
 * Audit-type tabs: the quarter segmented control's look, primary navigation. Switching writes `t`
 * (H&S = no `t`), keeps q/r and always lands on that type's overview (a details page belongs to one type).
 */
export function TypeTabs({ filter }: { filter: Filter }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const active: AuditType = filter.type ?? 'hs';
  const go = (type: AuditType) => {
    const next: Filter = { quarter: filter.quarter, regions: filter.regions, ...(type === 'hs' ? {} : { type }) };
    start(() => router.push(`/?${filterToQuery(next)}`, { scroll: window.location.pathname !== '/' }));
  };
  return (
    <div
      role="group"
      aria-label="Audit type"
      data-testid="type-tabs"
      aria-busy={pending}
      className="flex h-8 shrink-0 items-center gap-[clamp(10px,1.2vw,22px)] transition-opacity"
      style={{ opacity: pending ? 0.7 : 1 }}
    >
      {AUDIT_TYPES.map((t) => {
        const on = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={on}
            data-type={t.id}
            title={t.label}
            onClick={() => (on ? undefined : go(t.id))}
            className="tab h-8 whitespace-nowrap text-[13px]"
          >
            <span className="tab-label">{t.short}</span>
          </button>
        );
      })}
    </div>
  );
}
