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
import type { Audit, CategoryId } from '@/lib/types';
import { AuditDelta, GapBar } from './parts';
import { FindingGroups, type FindingGroup } from './FindingGroups';

export interface ContractorSlideData {
  audit: Audit;
  previous: Audit | null;
  index: number;
  sections: { A: number | null; B: number | null; C: number | null };
  gaps: { category: CategoryId; gapRate: number | null; findings: number }[];
  groups: FindingGroup[];
  findings: number;
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

/** One audit: score tile (slide header), the category gaps, findings by category. */
export function ContractorSlide({ d }: { d: ContractorSlideData }) {
  const { audit, previous } = d;
  const band = bandFor(audit.totalScore);
  return (
    <div className="grid grid-cols-1 gap-[var(--gap-grid)] min-[900px]:grid-cols-12">
      <BentoCard i={0} testid="slide-header" className={`tone-${bandTone(band)} justify-between gap-[clamp(12px,2svh,22px)] p-[clamp(16px,2.2svh,28px)] min-[900px]:col-span-5`}>
        <AuditLine audit={audit} />
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <p className="figure text-[clamp(64px,11svh,120px)]" data-testid="slide-score">
            {pct(audit.totalScore)}
            <span className="ml-0.5 text-[0.42em] tracking-normal text-muted">%</span>
          </p>
          <div className="flex flex-col items-end gap-1.5 pb-[0.5em]">
            <span className="badge px-2.5 py-[3px] text-[14px]" title={band}>{bandShort(band)}</span>
            <AuditDelta audit={audit} previous={previous} />
          </div>
        </div>
        <ScoreBar value={audit.totalScore} delay={0.15} />
        <SectionBars rings={d.sections} delay={0.2} />
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <span className="inline-flex items-center gap-1.5 text-[14px] text-muted" data-testid="positives">
            <ThumbsUp size={15} strokeWidth={2.4} className="text-[var(--good-dot)]" aria-hidden />
            <span className="num font-semibold text-ink">{d.positives}</span> positive {d.positives === 1 ? 'note' : 'notes'}
          </span>
          <Link
            href={href(`/audit/${audit.id}`, d.query)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[14px] font-semibold text-ground transition-transform active:scale-[0.97]"
          >
            Full report <ArrowRight size={15} strokeWidth={2.4} aria-hidden />
          </Link>
        </div>
      </BentoCard>

      <BentoCard i={1} testid="category-gaps" className="gap-2 px-[clamp(10px,1vw,18px)] py-[clamp(14px,2svh,24px)] min-[900px]:col-span-7">
        <TileLabel className="px-[clamp(6px,0.6vw,10px)]">Score lost by category</TileLabel>
        <ul className="grid flex-1 grid-cols-1 content-center gap-x-[clamp(12px,1.4vw,28px)] min-[1200px]:grid-flow-col min-[1200px]:grid-cols-2 min-[1200px]:grid-rows-5">
          {d.gaps.map((g) => {
            const c = categoryById(g.category);
            const Icon = CATEGORY_ICONS[c.icon];
            return (
              <li key={g.category}>
                <Link
                  data-testid="category-gap-row"
                  href={href(`/category/${g.category}/${d.contractorId}`, d.query, { s: d.index })}
                  className="group grid grid-cols-[18px_minmax(0,1fr)_minmax(48px,0.8fr)_3.2em_14px] items-center gap-2.5 rounded-[12px] px-[clamp(6px,0.6vw,10px)] py-[clamp(7px,1.2svh,11px)] transition-colors hover:bg-fill-2"
                  title={`${c.name}: gap ${pct(g.gapRate)}%, ${g.findings} observations`}
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

      <BentoCard i={2} testid="findings" className="gap-3 px-[clamp(10px,1vw,18px)] py-[clamp(14px,2svh,24px)] min-[900px]:col-span-12">
        <TileLabel className="px-2">
          Observations <span className="num text-ink">{d.findings}</span>
          <span className="font-normal">· by category, most first</span>
        </TileLabel>
        {d.groups.length ? <FindingGroups groups={d.groups} auditId={d.audit.id} /> : <p className="px-2 text-[15px] text-muted">No observations in this audit.</p>}
      </BentoCard>
    </div>
  );
}
