import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { BentoCard, TileLabel } from '@/components/bento/BentoGrid';
import { Signed } from '@/components/bento/parts';
import { pct, quarterLabel } from '@/lib/format';
import type { CategoryQuarter } from '@/lib/analytics';
import { CodeChip, GapBar } from './parts';

export interface CategorySlideData {
  q: CategoryQuarter;
  prevQuarter: string | null;
  contractorHref: (contractorId: string) => string;
  anchors: boolean;
}

/** One quarter of a category: gap with Δ, contractors ranked by their gap, the driving items. */
export function CategorySlide({ d }: { d: CategorySlideData }) {
  const { q } = d;
  const delta = q.gapRate !== null && q.prevGapRate !== null ? Math.round(q.gapRate * 100) - Math.round(q.prevGapRate * 100) : null;
  let rank = 0;
  let last: number | null = null;
  return (
    <div className="grid grid-cols-1 gap-[var(--gap-grid)] min-[900px]:grid-cols-12">
      <BentoCard i={0} testid="slide-header" className="justify-between gap-[clamp(12px,2svh,22px)] p-[clamp(16px,2.2svh,28px)] min-[900px]:col-span-4">
        <TileLabel>
          <span className="text-ink">{quarterLabel(q.quarter)}</span>
          <span aria-hidden>·</span>
          <span>{q.audits} {q.audits === 1 ? 'audit' : 'audits'}</span>
        </TileLabel>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <p className="figure text-[clamp(64px,11svh,120px)] text-[var(--gap)]" data-testid="slide-score">
            {pct(q.gapRate)}
            <span className="ml-0.5 text-[0.42em] tracking-normal">%</span>
          </p>
          <div className="flex flex-col gap-1 pb-[0.55em] text-[13px]">
            <span className="text-muted">gap</span>
            {delta !== null ? (
              <span data-testid="slide-delta" className="inline-flex items-center gap-1" title={`Gap ${pct(q.gapRate)}% vs ${pct(q.prevGapRate)}% in ${d.prevQuarter}`}>
                <Signed d={delta} invert />
                <span className="text-muted">vs {d.prevQuarter?.slice(0, 2)}</span>
              </span>
            ) : (
              <span className="text-muted">No earlier quarter</span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <GapBar value={q.gapRate} className="!h-[10px]" />
          <p className="text-[13px] leading-snug text-muted">Share of this category&apos;s weighted score lost, averaged over the quarter&apos;s audits.</p>
        </div>
        {q.contractors.length > 0 && (
          <dl className="grid grid-cols-2 gap-[var(--gap-grid)]">
            {[
              { k: 'Worst', r: q.contractors[0] },
              { k: 'Best', r: q.contractors[q.contractors.length - 1] },
            ].map(({ k, r }) => (
              <div key={k} className="flex min-w-0 flex-col gap-0.5 rounded-[14px] bg-surface-2 px-3 py-2.5">
                <dt className="text-[13px] text-muted">{k}</dt>
                <dd className="flex min-w-0 items-baseline justify-between gap-2">
                  <span className="truncate text-[14px] font-semibold" title={r.contractor.name}>{r.contractor.name}</span>
                  <span className="num text-[15px] font-semibold">{pct(r.gapRate)}%</span>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </BentoCard>

      <BentoCard i={1} testid="ranked-contractors" className="gap-2 px-[clamp(10px,1vw,18px)] py-[clamp(14px,2svh,24px)] min-[900px]:col-span-8">
        <TileLabel className="px-[clamp(6px,0.6vw,10px)]">Contractors · worst gap first</TileLabel>
        {/* Two columns read top-to-bottom, then left-to-right (rank order down each column). */}
        <ol
          className="grid grid-cols-1 gap-x-[clamp(12px,1.4vw,28px)] min-[1200px]:grid-flow-col min-[1200px]:grid-cols-2 min-[1200px]:[grid-template-rows:repeat(var(--rows),auto)]"
          style={{ '--rows': Math.ceil(q.contractors.length / 2) } as React.CSSProperties}
        >
          {q.contractors.map((r, i) => {
            if (last === null || r.gapRate !== last) rank = i + 1;
            last = r.gapRate;
            return (
              <li key={r.contractor.id}>
                <Link
                  data-testid="contractor-row"
                  href={d.contractorHref(r.contractor.id)}
                  className="group grid grid-cols-[1.4em_minmax(0,1.4fr)_minmax(40px,1fr)_3.2em_14px] items-center gap-2.5 rounded-[12px] px-[clamp(6px,0.6vw,10px)] py-[clamp(6px,1.1svh,10px)] transition-colors hover:bg-fill-2"
                  title={`${r.contractor.name}: gap ${pct(r.gapRate)}%, ${r.findings} negative observations`}
                >
                  <span className="num text-[13px] font-semibold text-faint">{rank}</span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[15px] font-semibold leading-tight tracking-[-0.015em]">{r.contractor.name}</span>
                    <span className="text-[12px] leading-tight text-muted">{r.contractor.subregion} · {r.findings} {r.findings === 1 ? 'note' : 'notes'}</span>
                  </span>
                  <GapBar value={r.gapRate} />
                  <span className="num text-right text-[16px] font-semibold">{pct(r.gapRate)}<span className="text-[0.72em] text-muted">%</span></span>
                  <ChevronRight size={14} strokeWidth={2.4} className="text-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ol>
      </BentoCard>

      <BentoCard i={2} testid="driving-items" className="gap-2 px-[clamp(10px,1vw,18px)] py-[clamp(14px,2svh,24px)] min-[900px]:col-span-12">
        <TileLabel className="px-[clamp(6px,0.6vw,10px)]">Driven by · noted audits × subsection score lost</TileLabel>
        {q.items.length ? (
          <ol
            className="grid grid-cols-1 gap-x-[clamp(16px,2vw,40px)] min-[1200px]:grid-flow-col min-[1200px]:grid-cols-2 min-[1200px]:[grid-template-rows:repeat(var(--rows),auto)]"
            style={{ '--rows': Math.ceil(q.items.length / 2) } as React.CSSProperties}
          >
            {q.items.map((it) => (
              <li
                key={it.itemCode}
                id={d.anchors ? `item-${it.itemCode}` : undefined}
                data-testid="driving-item"
                className="grid scroll-mt-24 grid-cols-[3.4em_minmax(0,1fr)_minmax(64px,0.28fr)_5.6em] items-center gap-2.5 rounded-[12px] px-[clamp(6px,0.6vw,10px)] py-[clamp(6px,1svh,9px)] target:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
              >
                <CodeChip code={it.itemCode} />
                <span className="line-clamp-2 text-[14px] leading-snug" title={it.question}>{it.question}</span>
                <span title={`${pct(it.severity)}% of the subsection score lost, on average, in the audits that noted it`}><GapBar value={it.severity} /></span>
                <span className="num whitespace-nowrap text-right text-[13px] text-muted">
                  noted <span className="text-[15px] font-semibold text-ink">{it.hits}</span>/{q.audits}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="px-2 text-[15px] text-muted">No item-level notes this quarter.</p>
        )}
      </BentoCard>
    </div>
  );
}
