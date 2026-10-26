import Link from 'next/link';
import { ArrowRight, ChevronRight, ThumbsUp } from 'lucide-react';
import { BentoCard, TileLabel } from '@/components/bento/BentoGrid';
import { ScoreBar } from '@/components/bento/parts';
import { SectionBars } from '@/components/charts/SectionBars';
import { CATEGORY_ICONS } from '@/components/charts/categoryIcons';
import { categoryById } from '@/lib/categories';
import { bandShort, bandTone, dateLabel, pct, quarterLabel } from '@/lib/format';
import { bandFor } from '@/lib/scoring';
import { href } from '@/lib/details';
import { CONTRACTOR_SCORE } from '@/lib/handoff';
import type { Audit, CategoryId } from '@/lib/types';
import { AuditDelta, GapBar } from './parts';

export interface ContractorSlideData {
  audit: Audit;
  previous: Audit | null;
  index: number;
  sections: { A: number | null; B: number | null; C: number | null };
  gaps: { category: CategoryId; gapRate: number | null; findings: number }[];
  /** Observations per category, most first (counts only; the text lives in the report and observation pages). */
  observations: { category: CategoryId; count: number }[];
  findings: number;
  /** The slide the page opens on: its score is the landing of a Contractors row hand-off. */
  landing: boolean;
  positives: number;
  contractorId: string;
  query: string;
}

/** The slide header line: date, quarter and inspection number. */
export function AuditLine({ audit }: { audit: Audit }) {
  return (
    <TileLabel className="flex-wrap !gap-x-2">
      <span className="text-ink">{dateLabel(audit.date)}</span>
      <span aria-hidden>·</span>
      <span>{quarterLabel(audit.quarter)}</span>
      <span aria-hidden>·</span>
      <span>Inspection {audit.inspectionNo}</span>
    </TileLabel>
  );
}

/**
 * One audit, one screen: the score tile (score, band, Δ, A/B/C sections), the category gaps worst first, and the
 * observations as counts per category, each opening that audit in the category. No codes, no note text.
 */
export function ContractorSlide({ d }: { d: ContractorSlideData }) {
  const { audit, previous } = d;
  const band = bandFor(audit.totalScore);
  const most = Math.max(1, ...d.observations.map((o) => o.count));
  const inCategory = (cat: CategoryId) => href(`/category/${cat}/${d.contractorId}`, d.query, { s: d.index });
  return (
    <div className="grid h-full grid-cols-1 gap-[var(--gap-grid)] min-[900px]:grid-cols-12 min-[900px]:grid-rows-[minmax(0,1fr)_auto]">
      <BentoCard i={0} testid="slide-header" className={`tone-${bandTone(band)} justify-between gap-[clamp(10px,1.6svh,20px)] p-[clamp(16px,2.2svh,28px)] min-[900px]:col-span-5`}>
        <AuditLine audit={audit} />
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <p className="figure text-[clamp(56px,10svh,120px)]" data-testid="slide-score">
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
        <ScoreBar value={audit.totalScore} delay={0.15} />
        <SectionBars rings={d.sections} delay={0.2} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-[14px] text-muted" data-testid="positives">
            <ThumbsUp size={15} strokeWidth={2.4} className="text-[var(--good-dot)]" aria-hidden />
            <span className="num font-semibold text-ink">{d.positives}</span> positive {d.positives === 1 ? 'note' : 'notes'}
          </span>
          <Link
            data-testid="full-report"
            href={href(`/audit/${audit.id}`, d.query)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[14px] font-semibold text-ground transition-transform active:scale-[0.97]"
          >
            Full report <ArrowRight size={15} strokeWidth={2.4} aria-hidden />
          </Link>
        </div>
      </BentoCard>

      <BentoCard i={1} testid="category-gaps" className="gap-1.5 px-[clamp(10px,1vw,18px)] py-[clamp(12px,1.8svh,22px)] min-[900px]:col-span-7">
        <div className="flex items-baseline justify-between gap-3 px-[clamp(6px,0.6vw,10px)]">
          <TileLabel>Score lost by category · worst first</TileLabel>
        </div>
        <ul className="grid flex-1 grid-cols-1 content-center gap-x-[clamp(12px,1.4vw,28px)] min-[1200px]:grid-flow-col min-[1200px]:grid-cols-2 min-[1200px]:grid-rows-4">
          {d.gaps.map((g) => {
            const c = categoryById(g.category);
            const Icon = CATEGORY_ICONS[c.icon];
            return (
              <li key={g.category}>
                <Link
                  data-testid="category-gap-row"
                  href={inCategory(g.category)}
                  className="group grid grid-cols-[18px_minmax(0,1fr)_minmax(48px,0.8fr)_3.2em_14px] items-center gap-2.5 rounded-[12px] px-[clamp(6px,0.6vw,10px)] py-[clamp(6px,1.1svh,11px)] transition-colors hover:bg-fill-2"
                  title={`${c.name}: ${pct(g.gapRate)}% score lost`}
                >
                  {Icon && <Icon size={16} strokeWidth={2.2} className="text-muted" aria-hidden />}
                  <span className="truncate text-[14px] font-semibold">{c.short}</span>
                  <GapBar value={g.gapRate} />
                  <span className="num text-right text-[15px] font-semibold">
                    {g.gapRate === null ? <span className="font-normal text-faint">N/A</span> : <>{pct(g.gapRate)}<span className="text-[0.75em] text-muted">%</span></>}
                  </span>
                  <ChevronRight size={14} strokeWidth={2.4} className="text-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      </BentoCard>

      <BentoCard i={2} testid="findings" className="gap-2 px-[clamp(10px,1vw,18px)] py-[clamp(12px,1.8svh,20px)] min-[900px]:col-span-12">
        <TileLabel className="px-[clamp(6px,0.6vw,10px)]">
          <span data-testid="findings-total" className="num text-ink">{d.findings}</span>
          <span>{d.findings === 1 ? 'observation' : 'observations'} · by category</span>
        </TileLabel>
        {d.observations.length ? (
          <ul className="grid grid-cols-2 gap-[clamp(6px,0.6vw,10px)] min-[900px]:grid-cols-4 min-[1200px]:grid-cols-8">
            {d.observations.map((o) => {
              const c = categoryById(o.category);
              const Icon = CATEGORY_ICONS[c.icon];
              return (
                <li key={o.category}>
                  <Link
                    data-testid="obs-count"
                    data-category={o.category}
                    data-count={o.count}
                    href={inCategory(o.category)}
                    aria-label={`${c.name}: ${o.count} ${o.count === 1 ? 'observation' : 'observations'}`}
                    title={`${c.name}: ${o.count} ${o.count === 1 ? 'observation' : 'observations'}`}
                    className="flex min-w-0 flex-col gap-1.5 rounded-[14px] bg-surface-2 px-3 py-2 transition-colors hover:bg-fill-2"
                  >
                    <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
                      {Icon && <Icon size={14} strokeWidth={2.4} style={{ color: c.color }} aria-hidden />}
                      <span className="truncate">{c.short}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="num text-[clamp(18px,2.6svh,24px)] font-semibold leading-none tracking-[-0.02em]">{o.count}</span>
                      <span className="relative block h-[6px] flex-1 overflow-hidden rounded-full bg-fill" aria-hidden>
                        <span className="absolute inset-y-0 left-0 rounded-full bg-[var(--muted)]" style={{ width: `${(o.count / most) * 100}%`, opacity: 0.55 }} />
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-2 text-[15px] text-muted">No observations in this audit.</p>
        )}
      </BentoCard>
    </div>
  );
}
