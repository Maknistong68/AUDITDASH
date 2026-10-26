import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { BentoCard, TileLabel } from '@/components/bento/BentoGrid';
import { auditCompliance, type ItemState } from '@/lib/analytics';
import { bandShort, bandTone, dateLabel, pct } from '@/lib/format';
import { bandFor } from '@/lib/scoring';
import type { Audit, ChecklistItem, Observation } from '@/lib/types';
import { AuditLine } from './ContractorSlide';
import { AuditDelta, CodeChip, GapBar, StatePill } from './parts';

export interface ItemsSlideData {
  audit: Audit;
  previous: Audit | null;
  rows: { item: ChecklistItem; state: ItemState; observation: Observation | null }[];
  itemHref: (code: string) => string;
  categoryName: string;
  /** This category's gap in each of the contractor's audits (latest first), to read this slide against. */
  history: { id: string; date: string; gap: number | null }[];
}

/** One audit of a contractor in one category: the category gap, the audit's score, each item's state. */
export function ItemsSlide({ d }: { d: ItemsSlideData }) {
  const { audit, previous, rows } = d;
  const band = bandFor(audit.totalScore);
  const compliance = auditCompliance(audit, rows.map((r) => r.item));
  const gap = compliance === null ? null : 1 - compliance;
  const count = (s: ItemState) => rows.filter((r) => r.state === s).length;
  return (
    <div className="grid grid-cols-1 gap-[var(--gap-grid)] min-[900px]:grid-cols-12">
      <BentoCard i={0} testid="slide-header" className={`tone-${bandTone(band)} justify-between gap-[clamp(12px,2svh,22px)] p-[clamp(16px,2.2svh,28px)] min-[900px]:col-span-4`}>
        <div className="flex flex-col gap-[clamp(12px,2svh,22px)]">
        <AuditLine audit={audit} />
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <p className="figure text-[clamp(56px,9.5svh,104px)] text-[var(--gap)]">
            {pct(gap)}
            {gap !== null && <span className="ml-0.5 text-[0.42em] tracking-normal">%</span>}
          </p>
          <p className="pb-[0.6em] text-[13px] leading-tight text-muted">gap in<br />{d.categoryName}</p>
        </div>
        <GapBar value={gap} className="!h-[10px]" />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[14px] bg-surface-2 px-3 py-2.5">
          <span className="text-[13px] text-muted">Audit score</span>
          <span className="num text-[20px] font-semibold tracking-[-0.02em]" data-testid="slide-score">{pct(audit.totalScore)}%</span>
          <span className="badge px-2 py-[2px] text-[12px]" title={band}>{bandShort(band)}</span>
          <AuditDelta audit={audit} previous={previous} />
        </div>
        {d.history.length > 1 && (
          <div className="flex flex-col gap-1.5" data-testid="category-history">
            <p className="text-[13px] text-muted">Gap per audit</p>
            <ul className="grid gap-1.5">
              {d.history.map((h) => (
                <li key={h.id} className="grid grid-cols-[6.2em_minmax(0,1fr)_3ch] items-center gap-2.5 text-[13px]">
                  <span className={h.id === audit.id ? 'font-semibold' : 'text-muted'}>{dateLabel(h.date)}</span>
                  <GapBar value={h.gap} className={h.id === audit.id ? '' : 'opacity-45'} />
                  <span className={`num text-right ${h.id === audit.id ? 'font-semibold' : 'text-muted'}`}>{pct(h.gap)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center">
          {(['finding', 'clear', 'na'] as ItemState[]).map((s) => (
            <div key={s} className="flex flex-col items-center gap-1">
              <dt><StatePill state={s} /></dt>
              <dd className="num text-[22px] font-semibold">{count(s)}</dd>
            </div>
          ))}
        </dl>
      </BentoCard>

      <BentoCard i={1} testid="items" className="gap-2 px-[clamp(10px,1vw,18px)] py-[clamp(14px,2svh,24px)] min-[900px]:col-span-8">
        <TileLabel className="px-[clamp(6px,0.6vw,10px)]">Checklist items · this audit</TileLabel>
        <ul className="grid">
          {rows.map((r) => (
            <li key={r.item.code}>
              <Link
                data-testid="item-row"
                data-state={r.state}
                href={d.itemHref(r.item.code)}
                className="group grid grid-cols-[3.4em_minmax(0,1fr)_auto_14px] items-center gap-3 rounded-[12px] px-[clamp(6px,0.6vw,10px)] py-[clamp(7px,1.2svh,11px)] transition-colors hover:bg-fill-2"
              >
                <CodeChip code={r.item.code} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="line-clamp-2 text-[14px] leading-snug">{r.item.question}</span>
                  {r.observation && (
                    <span className="truncate text-[13px] text-muted">{r.observation.text.replace(/\s+/g, ' ')}</span>
                  )}
                </span>
                <StatePill state={r.state} />
                <ChevronRight size={14} strokeWidth={2.4} className="text-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </BentoCard>
    </div>
  );
}
