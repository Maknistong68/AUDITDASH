'use client';
import { motion } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { CATEGORIES } from '@/lib/categories';
import { int } from '@/lib/format';
import {
  LOG_KINDS, activeFilters, clearedState, filterAuditRows, filterObs, logStateToQuery, obsHaystack, searchTerms,
  type LogData, type LogKind, type LogState, type LogView as View,
} from '@/lib/log';
import { QUICK, RISE, calm } from '@/lib/motion';
import type { CategoryId } from '@/lib/types';
import { AuditList } from './AuditList';
import { LogToolbar } from './LogToolbar';
import { ObservationList } from './ObservationList';

export interface LogContractor { id: string; name: string }

/**
 * The Log screen: title + Observations / Audits switch, the search and filter toolbar, then the matching rows.
 * Filtering is client side over the server's rows. The state is mirrored to the URL: text and in-page filters with
 * history.replaceState (no server round trip per key press); quarter and regions with a router replace so the top bar,
 * which shows the same `q` / `r`, re-renders with them. A navigation from outside (the top bar) resets to its URL.
 */
export function LogView({ data, contractors, initial }: { data: LogData; contractors: LogContractor[]; initial: LogState }) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const initialKey = logStateToQuery(initial);
  const [seenKey, setSeenKey] = useState(initialKey);
  const [state, setState] = useState(initial);
  if (initialKey !== seenKey) {
    setSeenKey(initialKey);
    setState(initial);
  }

  const query = logStateToQuery(state);
  useEffect(() => {
    if (window.location.search.slice(1) !== query) window.history.replaceState(window.history.state, '', `${pathname}?${query}`);
  }, [query, pathname]);

  const update = (patch: Partial<LogState>) => {
    const next = { ...state, ...patch };
    setState(next);
    if (('quarter' in patch && patch.quarter !== state.quarter) || ('regions' in patch && patch.regions?.join() !== state.regions.join())) {
      startTransition(() => router.replace(`${pathname}?${logStateToQuery(next)}`, { scroll: false }));
    }
  };
  const clear = () => update(clearedState(state));

  // Search runs on a deferred copy of the text so typing stays instant.
  const search = useDeferredValue(state.search);
  const view = { ...state, search };
  const terms = useMemo(() => searchTerms(search), [search]);
  const audits = useMemo(() => new Map(data.audits.map((a) => [a.id, a])), [data]);
  const haystacks = useMemo(() => data.observations.map((o) => obsHaystack(o, audits.get(o.auditId)!, data.questions)), [data, audits]);

  const key = logStateToQuery(view);
  const obsRows = useMemo(() => filterObs(data, view, haystacks), [key, data, haystacks]); // eslint-disable-line react-hooks/exhaustive-deps
  const auditRows = useMemo(() => filterAuditRows(data, view), [key, data]); // eslint-disable-line react-hooks/exhaustive-deps
  // Facet counts: each chip group counts what the other filters leave.
  const kindCounts = useMemo(() => {
    const out = Object.fromEntries(LOG_KINDS.map((k) => [k, 0])) as Record<LogKind, number>;
    for (const r of filterObs(data, { ...view, kinds: [] }, haystacks)) out[r.obs.kind]++;
    return out;
  }, [key, data, haystacks]); // eslint-disable-line react-hooks/exhaustive-deps
  const catCounts = useMemo(() => {
    const out = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0])) as Record<CategoryId, number>;
    for (const r of filterObs(data, { ...view, categories: [] }, haystacks)) if (r.obs.category) out[r.obs.category]++;
    return out;
  }, [key, data, haystacks]); // eslint-disable-line react-hooks/exhaustive-deps

  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      searchRef.current?.focus({ preventScroll: true });
      searchRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      searchRef.current?.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const isObs = state.view === 'observations';
  const total = isObs ? data.observations.length : data.audits.length;
  const shown = isObs ? obsRows.length : auditRows.length;
  // Links keep the quarter/region filter (the app's drill pages read it).
  const linkQuery = new URLSearchParams({ q: state.quarter, r: state.regions.join(',') }).toString();

  return (
    <div className="flex flex-col gap-[var(--gap-grid)] px-[var(--gutter)]">
      <motion.header
        initial={RISE.initial}
        animate={RISE.animate}
        transition={calm(0)}
        className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3"
      >
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold leading-[1.05] tracking-[-0.035em] min-[900px]:text-[clamp(28px,4svh,36px)]">Log</h1>
          <p className="mt-1 text-[clamp(13px,1.6svh,15px)] text-muted">Every observation and audit, searchable</p>
        </div>
        <ViewSwitch view={state.view} counts={{ observations: data.observations.length, audits: data.audits.length }} onChange={(v) => update({ view: v })} />
      </motion.header>

      <LogToolbar
        state={state}
        update={update}
        clear={clear}
        contractors={contractors}
        kindCounts={kindCounts}
        catCounts={catCounts}
        active={activeFilters(state)}
        shown={shown}
        total={total}
        searchRef={searchRef}
      />

      <p className="sr-only" aria-live="polite">{`${int(shown)} of ${int(total)} ${isObs ? 'observations' : 'audits'}`}</p>

      {isObs ? (
        <ObservationList rows={obsRows} terms={terms} questions={data.questions} linkQuery={linkQuery} resetKey={key} onClear={clear} />
      ) : (
        <AuditList rows={auditRows} terms={terms} linkQuery={linkQuery} resetKey={key} onClear={clear} />
      )}
    </div>
  );
}

/** Apple segmented control with a sliding thumb (the same as the top bar's quarter control). */
function ViewSwitch({ view, counts, onChange }: { view: View; counts: Record<View, number>; onChange: (v: View) => void }) {
  const opts: { id: View; label: string }[] = [
    { id: 'observations', label: 'Observations' },
    { id: 'audits', label: 'Audits' },
  ];
  return (
    <div role="tablist" aria-label="Show" className="flex h-10 items-center rounded-full bg-fill p-[3px]" data-testid="log-view-switch">
      {opts.map((o) => {
        const on = o.id === view;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={on}
            data-testid={`log-view-${o.id}`}
            onClick={() => onChange(o.id)}
            className={`relative h-[34px] rounded-full px-4 text-[14px] transition-colors ${on ? 'font-semibold text-ink' : 'text-muted hover:text-ink'}`}
          >
            {on && (
              <motion.span
                layoutId="log-view-thumb"
                className="absolute inset-0 rounded-full bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.04)] dark:bg-[#636366]"
                transition={QUICK}
              />
            )}
            <span className="relative flex items-baseline gap-1.5">
              {o.label}
              <span className={`num text-[12px] ${on ? 'text-muted' : 'text-faint'}`}>{int(counts[o.id])}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
