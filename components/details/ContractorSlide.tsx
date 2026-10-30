import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { BentoCard, TileLabel } from '@/components/bento/BentoGrid';
import { ScoreBar } from '@/components/bento/parts';
import { SectionBars } from '@/components/charts/SectionBars';
import { CATEGORY_ICONS } from '@/components/charts/categoryIcons';
import { categoryById } from '@/lib/categories';
import { bandShort, bandTone, dateLabel, pct } from '@/lib/format';
import { bandFor } from '@/lib/scoring';
import { href } from '@/lib/details';
import { CONTRACTOR_SCORE } from '@/lib/handoff';
import type { ContractorRepeat } from '@/lib/analytics';
import type { Audit, CategoryId } from '@/lib/types';
import { AuditDelta, GapBar } from './parts';

export interface ContractorSlideData {
  audit: Audit;
  previous: Audit | null;
  index: number;
  sections: { A: number | null; B: number | null; C: number | null };
  gaps: { category: CategoryId; gapRate: number | null; findings: number }[];
  /** The contractor's top 3 repeated questions (contractorRepeats); the same on every slide. [] = no follow-up audit. */
  repeats: ContractorRepeat[];
  /** The slide the page opens on: its score is the landing of a Contractors row hand-off. */
  landing: boolean;
  positives: number;
  contractorId: string;
  query: string;
}

/** The slide header line: the audit's date. */
export function AuditLine({ audit }: { audit: Audit }) {
  return (
    <TileLabel className="flex-wrap !gap-x-2">
      <span className="text-ink">{dateLabel(audit.date)}</span>
    </TileLabel>
  );
}

/**
 * One audit, one screen: the score tile (score, band, Δ, then the A/B/C sections in a compact block under the figure),
 * the category gaps worst first, and the contractor's top 3 repeated observations, each opening its question. No codes,
 * no note text.
 */
export function ContractorSlide({ d }: { d: ContractorSlideData }) {
  const { audit, previous } = d;
  const band = bandFor(audit.totalScore);
  const inCategory = (cat: CategoryId) => href(`/category/${cat}/${d.contractorId}`, d.query, { s: d.index });
  return (
    // Cards are as tall as the tallest column's content, capped at the screen (flex-initial shrinks, never grows). On a
    // laptop-height screen (<= 900px) they fill to the bottom instead, so no empty band is left under them; the lists
    // spread their rows and the score grows.
    <div className="flex h-full flex-col">
    <div className="grid min-h-0 flex-initial grid-cols-1 gap-[var(--gap-grid)] min-[900px]:grid-cols-12 min-[900px]:grid-rows-[minmax(0,1fr)] [@media(min-width:1200px)_and_(max-height:900px)]:flex-1">
      <BentoCard i={0} testid="slide-header" className={`tone-${bandTone(band)} justify-between gap-[clamp(12px,2.2svh,26px)] p-[clamp(16px,2.2svh,28px)] min-[900px]:col-span-4`}>
        <AuditLine audit={audit} />
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <p className="figure text-[clamp(56px,13svh,150px)] [@media(min-width:1200px)_and_(max-height:900px)]:text-[clamp(56px,17svh,150px)] [@media(min-width:1200px)_and_(min-height:901px)]:text-[clamp(56px,18svh,190px)]" data-testid="slide-score">
            <span style={d.landing ? { viewTransitionName: CONTRACTOR_SCORE } : undefined}>
              {pct(audit.totalScore)}
              <span className="ml-0.5 text-[0.42em] tracking-normal text-muted">%</span>
            </span>
          </p>
          <div className="flex flex-col items-end gap-1.5 pb-[0.5em]">
            <span className="badge px-2.5 py-[3px] text-[14px]" title={band}>{bandShort(band)}</span>
            <AuditDelta audit={audit} previous={previous} />
          </div>
        </div>
        <div className="flex flex-col gap-[clamp(10px,1.8svh,20px)]">
          <ScoreBar value={audit.totalScore} delay={0.15} />
          <SectionBars rings={d.sections} delay={0.2} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-[14px] text-muted" data-testid="positives">
            <span className="num font-semibold text-ink">{d.positives}</span> positive {d.positives === 1 ? 'note' : 'notes'}
          </span>
          <Link
            data-testid="full-report"
            href={href(`/audit/${audit.id}`, d.query)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[14px] font-semibold text-ground transition-transform active:scale-[0.97]"
          >
            Full report
          </Link>
        </div>
      </BentoCard>

      <BentoCard i={1} testid="category-gaps" className="gap-1 px-[clamp(10px,1vw,18px)] py-[clamp(12px,1.8svh,22px)] min-[900px]:col-span-4">
        <TileLabel className="px-[clamp(6px,0.6vw,10px)] pb-1">Score lost</TileLabel>
        <ul className="grid min-h-0 flex-auto content-evenly">
          {d.gaps.map((g) => {
            const c = categoryById(g.category);
            const Icon = CATEGORY_ICONS[c.icon];
            return (
              <li key={g.category}>
                <Link
                  data-testid="category-gap-row"
                  href={inCategory(g.category)}
                  className="group grid gap-[clamp(4px,0.7svh,8px)] rounded-[12px] px-[clamp(6px,0.6vw,10px)] py-[clamp(4px,1.1svh,13px)] transition-colors hover:bg-fill-2 [@media(min-width:1200px)_and_(max-height:620px)]:py-[3px]"
                  title={`${c.name}: ${pct(g.gapRate)}% score lost`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    {Icon && <Icon size={16} strokeWidth={2.2} className="shrink-0 text-muted" aria-hidden />}
                    <span className="min-w-0 flex-1 truncate text-[clamp(14px,1.6svh,18px)] font-semibold">{c.short}</span>
                    <span className="num text-right text-[15px] font-semibold">
                      {g.gapRate === null ? <span className="font-normal text-faint">N/A</span> : <>{pct(g.gapRate)}<span className="text-[0.75em] text-muted">%</span></>}
                    </span>
                    <ChevronRight size={14} strokeWidth={2.4} className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                  <GapBar value={g.gapRate} className="!h-[clamp(7px,1.1svh,12px)]" />
                </Link>
              </li>
            );
          })}
        </ul>
      </BentoCard>

      <BentoCard i={2} testid="top-repeats" className="gap-[clamp(6px,1svh,10px)] px-[clamp(10px,1vw,18px)] py-[clamp(12px,1.8svh,22px)] min-[900px]:col-span-4">
        <TileLabel className="px-[clamp(6px,0.6vw,10px)]">Repeated</TileLabel>
        {d.repeats.length ? (
          <ol className="grid min-h-0 flex-auto auto-rows-fr gap-[clamp(6px,1svh,10px)]">
            {d.repeats.map((r) => {
              const c = categoryById(r.category);
              const Icon = CATEGORY_ICONS[c.icon];
              const when = r.audits.map((a) => dateLabel(a.date)).join(' → ');
              return (
                <li key={r.itemCode} className="min-h-0">
                  <Link
                    data-testid="top-repeat"
                    data-item={r.itemCode}
                    data-times={r.times}
                    href={href(`/category/${r.category}/${d.contractorId}/${encodeURIComponent(r.itemCode)}`, d.query)}
                    aria-label={`${r.label}: repeated ${r.times} ${r.times === 1 ? 'time' : 'times'}, a finding in the audits of ${when}`}
                    className="group grid h-full min-h-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-[clamp(10px,1vw,18px)] rounded-[14px] bg-fill-2 px-[clamp(10px,1vw,16px)] py-[clamp(6px,1.2svh,14px)] transition-colors hover:bg-fill"
                  >
                    <span className="flex min-w-0 flex-col gap-[clamp(2px,0.6svh,6px)]">
                      <span className="flex min-w-0 items-start gap-2.5">
                        {Icon && <Icon size={16} strokeWidth={2.2} className="mt-[3px] shrink-0" style={{ color: c.color }} aria-hidden />}
                        <span data-testid="top-repeat-label" className="line-clamp-2 min-w-0 text-[clamp(14px,1.8svh,19px)] font-semibold leading-snug" title={r.label}>{r.label}</span>
                      </span>
                      <span data-testid="top-repeat-marker" className="num pl-[26px] text-[12px] text-muted" title={`A finding in the audits of ${when}`}>
                        {r.audits.map((a, k) => (
                          <span key={a.id}>
                            {k > 0 && <span aria-hidden> → </span>}
                            <span className={a.id === audit.id ? 'font-semibold text-ink' : undefined}>{a.quarter.slice(0, 2)}</span>
                          </span>
                        ))}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="flex flex-col items-end leading-none">
                        <span data-testid="top-repeat-times" className="figure num mt-1 text-[clamp(22px,3.6svh,36px)]">{r.times}×</span>
                      </span>
                      <ChevronRight size={14} strokeWidth={2.4} className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : (
          <div data-testid="top-repeats-empty" className="flex min-h-[clamp(120px,20svh,220px)] flex-auto flex-col items-center justify-center gap-1.5 rounded-[14px] bg-fill-2 px-6 text-center">
            <p className="text-[clamp(15px,1.8svh,18px)] font-semibold">First audit</p>
          </div>
        )}
      </BentoCard>
    </div>
    </div>
  );
}
