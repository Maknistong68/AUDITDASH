import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { BentoCard, TileLabel } from '@/components/bento/BentoGrid';
import { Signed } from '@/components/bento/parts';
import { itemLabel } from '@/lib/itemLabels';
import { pct, quarterLabel } from '@/lib/format';
import type { CategoryQuarter } from '@/lib/analytics';
import { FitList } from './FitList';
import { GapBar } from './parts';

export interface CategorySlideData {
  q: CategoryQuarter;
  prevQuarter: string | null;
  contractorHref: (contractorId: string) => string;
  anchors: boolean;
}

/**
 * One quarter of a category, one screen: the score lost with Δ, contractors worst first (the top that fit, then
 * "+M more"), and the driving items as plain labels with a bar and "N of M audits". No codes, no sentences.
 */
export function CategorySlide({ d }: { d: CategorySlideData }) {
  const { q } = d;
  const delta = q.gapRate !== null && q.prevGapRate !== null ? Math.round(q.gapRate * 100) - Math.round(q.prevGapRate * 100) : null;
  let rank = 0;
  let last: number | null = null;
  const ranks = q.contractors.map((r, i) => {
    if (last === null || r.gapRate !== last) rank = i + 1;
    last = r.gapRate;
    return rank;
  });
  return (
    // Cards are as tall as the tallest column's content, capped at the screen (flex-initial shrinks, never grows).
    <div className="flex h-full flex-col">
    <div className="grid min-h-0 flex-initial grid-cols-1 gap-[var(--gap-grid)] min-[900px]:grid-cols-12 min-[900px]:grid-rows-[minmax(0,1fr)]">
      <BentoCard i={0} testid="slide-header" className="justify-between gap-[clamp(10px,1.6svh,20px)] p-[clamp(16px,2.2svh,28px)] min-[900px]:col-span-3">
        <TileLabel>
          <span className="text-ink">{quarterLabel(q.quarter)}</span>
          <span aria-hidden>·</span>
          <span>{q.audits} {q.audits === 1 ? 'audit' : 'audits'}</span>
        </TileLabel>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
          <p className="figure text-[clamp(56px,min(15.5svh,8.5vw),190px)] text-[var(--gap)]" data-testid="slide-score">
            {pct(q.gapRate)}
            <span className="ml-0.5 text-[0.42em] tracking-normal">%</span>
          </p>
          <div className="flex flex-col gap-1 pb-[0.55em] text-[13px]">
            <span className="text-muted">score lost</span>
            {delta !== null ? (
              <span data-testid="slide-delta" className="inline-flex items-center gap-1" title={`Score lost ${pct(q.gapRate)}% vs ${pct(q.prevGapRate)}% in ${d.prevQuarter}`}>
                <Signed d={delta} invert />
                <span className="text-muted">vs {d.prevQuarter?.slice(0, 2)}</span>
              </span>
            ) : (
              <span className="text-muted">No earlier quarter</span>
            )}
            </div>
        </div>
        <GapBar value={q.gapRate} className="!h-[clamp(10px,1.2svh,14px)]" />
        {q.contractors.length > 0 && (
          <dl className="contents">
            {[
              { k: 'Worst', r: q.contractors[0] },
              { k: 'Best', r: q.contractors[q.contractors.length - 1] },
            ].map(({ k, r }) => (
              <div key={k} className="flex min-w-0 flex-col gap-0.5 rounded-[14px] bg-surface-2 px-3 py-[clamp(8px,1.6svh,18px)]">
                <dt className="text-[13px] text-muted">{k} · score lost</dt>
                <dd className="flex min-w-0 items-baseline justify-between gap-2">
                  <span className="truncate text-[clamp(14px,1.6svh,18px)] font-semibold" title={r.contractor.name}>{r.contractor.name}</span>
                  <span className="num text-[clamp(15px,1.9svh,22px)] font-semibold">{pct(r.gapRate)}%</span>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </BentoCard>

      <BentoCard i={1} testid="ranked-contractors" className="gap-1.5 px-[clamp(10px,1vw,18px)] py-[clamp(12px,1.8svh,22px)] min-[900px]:col-span-4">
        <div className="flex items-baseline justify-between gap-3 px-[clamp(6px,0.6vw,10px)]">
          <TileLabel>Contractors · worst first</TileLabel>
          <span className="text-[12px] text-muted">score lost</span>
        </div>
        <FitList testid="contractor-list" label="contractors" className="grid content-evenly">
          {q.contractors.map((r, i) => (
            <Link
              key={r.contractor.id}
              data-testid="contractor-row"
              href={d.contractorHref(r.contractor.id)}
              className="group grid grid-cols-[1.4em_minmax(0,1.6fr)_minmax(40px,1fr)_3em_14px] items-center gap-2.5 rounded-[12px] px-[clamp(6px,0.6vw,10px)] py-[clamp(4px,0.85svh,10px)] transition-colors hover:bg-fill-2"
              title={`${r.contractor.name}: ${pct(r.gapRate)}% score lost`}
            >
              <span className="num text-[13px] font-semibold text-faint">{ranks[i]}</span>
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="truncate text-[15px] font-semibold leading-tight tracking-[-0.015em]">{r.contractor.name}</span>
                <span className="hidden shrink-0 text-[12px] text-muted min-[1600px]:inline">{r.contractor.subregion}</span>
              </span>
              <GapBar value={r.gapRate} />
              <span className="num text-right text-[16px] font-semibold">{pct(r.gapRate)}<span className="text-[0.72em] text-muted">%</span></span>
              <ChevronRight size={14} strokeWidth={2.4} className="text-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          ))}
        </FitList>
      </BentoCard>

      <BentoCard i={2} testid="driving-items" className="gap-1.5 px-[clamp(10px,1vw,18px)] py-[clamp(12px,1.8svh,22px)] min-[900px]:col-span-5">
        <div className="flex items-baseline justify-between gap-3 px-[clamp(6px,0.6vw,10px)]">
          <TileLabel>Driven by</TileLabel>
          <span className="text-[12px] text-muted">audits noted</span>
        </div>
        {q.items.length ? (
          <FitList testid="driver-list" label="items" className="grid content-evenly">
            {q.items.map((it) => {
              const label = itemLabel(it.itemCode, it.question);
              return (
                <div
                  key={it.itemCode}
                  id={d.anchors ? `item-${it.itemCode}` : undefined}
                  data-testid="driving-item"
                  className="grid gap-[clamp(4px,0.7svh,8px)] rounded-[12px] px-[clamp(6px,0.6vw,10px)] py-[clamp(4px,1.1svh,13px)] target:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
                  title={`${label}: noted in ${it.hits} of ${q.audits} audits`}
                >
                  <span className="flex min-w-0 items-baseline justify-between gap-3">
                    <span data-testid="driving-item-label" className="truncate text-[clamp(14px,1.6svh,18px)] font-semibold leading-tight tracking-[-0.01em]">{label}</span>
                    <span data-testid="driving-item-count" className="num shrink-0 whitespace-nowrap text-right text-[13px] text-muted">
                      <span className="text-[15px] font-semibold text-ink">{it.hits}</span> of {q.audits} audits
                    </span>
                  </span>
                  <GapBar value={q.audits ? it.hits / q.audits : null} className="!h-[clamp(7px,1.1svh,12px)]" />
                </div>
              );
            })}
          </FitList>
        ) : (
          <p className="px-2 text-[15px] text-muted">No item-level notes this quarter.</p>
        )}
      </BentoCard>
    </div>
    </div>
  );
}
