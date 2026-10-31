'use client';
import { motion } from 'framer-motion';
import { ChevronDown, X } from 'lucide-react';
import type { RefObject } from 'react';
import { CATEGORY_ICONS } from '@/components/charts/categoryIcons';
import { CATEGORIES } from '@/lib/categories';
import { QUARTERS, REGIONS } from '@/lib/filters';
import { int, quarterLabel } from '@/lib/format';
import { KIND_LABEL, LOG_KINDS, type LogKind, type LogState } from '@/lib/log';
import { RISE, calm } from '@/lib/motion';
import type { CategoryId, Quarter } from '@/lib/types';
import type { LogContractor } from './LogView';
import { KIND_TONE } from './parts';

const toggle = <T,>(xs: T[], x: T): T[] => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

const PILL = 'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] transition-[background-color,color,opacity] duration-300';
const pillCls = (on: boolean, empty = false) =>
  `${PILL} ${on ? 'bg-fill font-semibold text-ink shadow-[inset_0_0_0_1px_var(--accent)]' : empty ? 'bg-fill-2 text-faint opacity-60 hover:opacity-100' : 'bg-fill-2 text-ink hover:bg-fill'}`;

/**
 * Search box and filters. Search: every word must match (text, question, contractor, auditors, item code); `/` focuses it.
 * Selects: contractor, quarter; toggles: regions, date sort. Observations add kind and category chips with live counts.
 * The result count and Clear all close the card.
 */
export function LogToolbar({ state, update, clear, contractors, kindCounts, catCounts, active, shown, total, searchRef }: {
  state: LogState;
  update: (patch: Partial<LogState>) => void;
  clear: () => void;
  contractors: LogContractor[];
  kindCounts: Record<LogKind, number>;
  catCounts: Record<CategoryId, number>;
  active: number;
  shown: number;
  total: number;
  searchRef: RefObject<HTMLInputElement | null>;
}) {
  const isObs = state.view === 'observations';
  return (
    <motion.section
      data-testid="log-toolbar"
      aria-label="Search and filters"
      initial={RISE.initial}
      animate={RISE.animate}
      transition={calm(0.08)}
      className="card flex flex-col gap-3 px-[clamp(12px,1.3vw,22px)] py-[clamp(12px,1.6svh,18px)]"
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="group/search relative flex h-11 min-w-0 flex-[1_1_320px] items-center rounded-full bg-fill-2 pl-4 pr-2 transition-shadow focus-within:shadow-[0_0_0_2px_var(--accent)]">
          <span className="sr-only">Search</span>
          <input
            ref={searchRef}
            type="search"
            data-testid="log-search"
            value={state.search}
            onChange={(e) => update({ search: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && state.search) {
                e.preventDefault();
                update({ search: '' });
              }
            }}
            placeholder={isObs ? 'Search observations' : 'Search audits'}
            autoComplete="off"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
            style={{ outline: 'none' }}
          />
          {state.search ? (
            <button
              type="button"
              onClick={() => { update({ search: '' }); searchRef.current?.focus(); }}
              aria-label="Clear search"
              className="grid size-7 shrink-0 place-items-center rounded-full bg-fill text-muted transition-colors hover:text-ink"
            >
              <X size={14} strokeWidth={2.6} />
            </button>
          ) : (
            <kbd className="mr-1.5 hidden h-6 min-w-6 shrink-0 place-items-center rounded-md border border-hairline px-1.5 text-[12px] font-semibold text-faint min-[700px]:grid" aria-label="Press slash to search">/</kbd>
          )}
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            label="Contractor"
            testid="log-contractor"
            value={state.contractor ?? ''}
            onChange={(v) => update({ contractor: v || null })}
            options={[{ value: '', label: 'All contractors' }, ...contractors.map((c) => ({ value: c.id, label: c.name }))]}
            wide
          />
          <Select
            label="Quarter"
            testid="log-quarter"
            value={state.quarter}
            onChange={(v) => update({ quarter: v as Quarter | 'all' })}
            options={[{ value: 'all', label: 'All quarters' }, ...[...QUARTERS].reverse().map((q) => ({ value: q, label: quarterLabel(q) }))]}
          />
          <div role="group" aria-label="Sub-region" className="flex items-center gap-1">
            {REGIONS.map((r) => {
              const on = state.regions.includes(r);
              return (
                <button key={r} type="button" aria-pressed={on} data-testid={`log-region-${r}`} onClick={() => update({ regions: REGIONS.filter((x) => (x === r ? !on : state.regions.includes(x))) })} className={pillCls(on)}>
                  {r}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            data-testid="log-sort"
            onClick={() => update({ sort: state.sort === 'newest' ? 'oldest' : 'newest' })}
            className={`${PILL} bg-fill-2 text-ink hover:bg-fill`}
            aria-label={`Sorted ${state.sort === 'newest' ? 'newest' : 'oldest'} first. Change sort`}
          >
            {state.sort === 'newest' ? 'Newest' : 'Oldest'}
          </button>
        </div>
      </div>

      {isObs && (
        <div className="flex flex-col gap-2">
          <ChipRow label="Kind">
            {LOG_KINDS.map((k) => {
              const on = state.kinds.includes(k);
              const n = kindCounts[k];
              return (
                <button key={k} type="button" aria-pressed={on} data-testid={`log-kind-${k}`} onClick={() => update({ kinds: toggle(state.kinds, k) })} className={`${KIND_TONE[k]} ${pillCls(on, !n && !on)}`}>
                  <span className="size-[7px] rounded-full" style={{ background: k === 'note' ? 'var(--faint)' : 'var(--tone-dot)' }} aria-hidden />
                  {KIND_LABEL[k]}
                  <span className={`num text-[12px] ${on ? 'opacity-70' : 'text-faint'}`}>{int(n)}</span>
                </button>
              );
            })}
          </ChipRow>
          <ChipRow label="Category">
            {CATEGORIES.map((c) => {
              const on = state.categories.includes(c.id);
              const n = catCounts[c.id];
              const Icon = CATEGORY_ICONS[c.icon];
              return (
                <button key={c.id} type="button" aria-pressed={on} title={c.name} data-testid={`log-cat-${c.id}`} onClick={() => update({ categories: toggle(state.categories, c.id) })} className={pillCls(on, !n && !on)}>
                  {Icon && <Icon size={14} strokeWidth={2.4} style={{ color: on ? undefined : c.color }} aria-hidden />}
                  {c.short}
                  <span className={`num text-[12px] ${on ? 'opacity-70' : 'text-faint'}`}>{int(n)}</span>
                </button>
              );
            })}
          </ChipRow>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-hairline pt-2.5">
        <p data-testid="log-count" className="text-[13px] text-muted">
          <span className="num text-[15px] font-semibold text-ink">{int(shown)}</span>
          <span> of </span>
          <span className="num">{int(total)}</span>
          <span> {isObs ? 'observations' : 'audits'}</span>
        </p>
        <button
          type="button"
          data-testid="log-clear"
          onClick={clear}
          disabled={!active}
          className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-[var(--accent)] transition-opacity hover:bg-fill-2 disabled:pointer-events-none disabled:opacity-0"
        >
          <X size={14} strokeWidth={2.6} aria-hidden />
          Clear all{active > 1 ? ` (${active})` : ''}
        </button>
      </div>
    </motion.section>
  );
}

/** A labelled row of chips; scrolls sideways on narrow screens instead of piling up. */
function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="-mx-[clamp(12px,1.3vw,22px)] flex min-w-0 items-center gap-1.5 overflow-x-auto px-[clamp(12px,1.3vw,22px)] [scrollbar-width:none] min-[700px]:mx-0 min-[700px]:flex-wrap min-[700px]:overflow-visible min-[700px]:px-0">
      {children}
    </div>
  );
}

/** A native select dressed as a pill (keyboard and touch friendly). */
function Select({ label, value, onChange, options, testid, wide = false }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; testid: string; wide?: boolean;
}) {
  const on = value !== '' && value !== 'all';
  return (
    <span className="relative inline-flex">
      <select
        aria-label={label}
        data-testid={testid}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-8 cursor-pointer appearance-none truncate rounded-full pl-3 pr-8 text-[13px] outline-none transition-colors ${wide ? 'max-w-[15rem]' : ''} ${on ? 'bg-fill font-semibold text-ink shadow-[inset_0_0_0_1px_var(--accent)]' : 'bg-fill-2 text-ink hover:bg-fill'}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-surface text-ink">{o.label}</option>
        ))}
      </select>
      <ChevronDown size={14} strokeWidth={2.4} className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 ${on ? 'text-ground' : 'text-muted'}`} aria-hidden />
    </span>
  );
}
