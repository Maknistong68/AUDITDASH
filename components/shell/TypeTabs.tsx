'use client';
import { motion } from 'framer-motion';
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
      className="flex h-8 shrink-0 items-center rounded-full bg-fill p-[2px] transition-opacity"
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
            className={`relative h-7 whitespace-nowrap rounded-full px-2 text-[13px] transition-colors min-[640px]:px-3 min-[1440px]:px-3.5 ${on ? 'font-semibold text-ink' : 'text-muted hover:text-ink'}`}
          >
            {on && (
              <motion.span
                layoutId="type-thumb"
                className="absolute inset-0 rounded-full bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.04)] dark:bg-[#636366]"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative">{t.short}</span>
          </button>
        );
      })}
    </div>
  );
}
