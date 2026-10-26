import { categoryById } from '@/lib/categories';
import { pct } from '@/lib/format';
import type { CategoryId } from '@/lib/types';
import { Signed } from '@/components/bento/parts';
import { GapBar } from '@/components/details/parts';
import { CATEGORY_ICONS } from './categoryIcons';

export interface GapRow { category: CategoryId; gapRate: number | null; prevGapRate: number | null; findings: number }

/** "Where it fails" order: worst score-based gap first (gap = share of the category's weighted score lost; 0 = none). */
export function rankGaps<T extends GapRow>(gaps: T[]): T[] {
  return [...gaps].sort((a, b) => (b.gapRate ?? -1) - (a.gapRate ?? -1));
}

/** The tile's frame: a card that lifts on hover. */
export const GAP_TILE_CLASS =
  'card lift group flex w-full min-w-0 flex-col gap-[clamp(12px,1.8svh,20px)] p-[clamp(16px,1.3vw,24px)] transition-[translate,box-shadow] duration-300 hover:-translate-y-1';

const valid = (g: GapRow) => g.gapRate !== null && Number.isFinite(g.gapRate);

/** Screen-reader name of a tile: "1. Subcontractor Control: 73% gap, 40 findings". */
export function gapTileLabel(g: GapRow, rank: number): string {
  const cat = categoryById(g.category);
  return `${rank}. ${cat.name}: ${valid(g) ? `${pct(g.gapRate)}% gap` : 'not applicable'}, ${g.findings} findings`;
}

/**
 * One category tile ("Where it fails"): rank, icon, short name, the gap %, a gap bar in the single `--gap` hue, the
 * findings count and, when there is a previous quarter in the filter, the Δ in whole points (a rising gap is bad,
 * so it reads red). Rendered inside a link carrying GAP_TILE_CLASS (see CategorySlider).
 */
export function GapTileBody({ g, rank }: { g: GapRow; rank: number }) {
  const cat = categoryById(g.category);
  const Icon = CATEGORY_ICONS[cat.icon];
  const ok = valid(g);
  const d = ok && g.prevGapRate !== null ? Math.round(g.gapRate! * 100) - Math.round(g.prevGapRate * 100) : null;
  return (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]">
          {Icon && <Icon size={17} strokeWidth={2} className="shrink-0 text-muted transition-colors group-hover:text-ink" aria-hidden />}
          <span className="truncate">{cat.short}</span>
        </span>
        <span className="num text-[13px] font-semibold text-faint">{rank}</span>
      </span>
      <span className="flex items-baseline gap-2">
        <span className="figure text-[clamp(38px,4.8svh,56px)]">
          {ok ? pct(g.gapRate) : <span className="text-faint">—</span>}
          {ok && <span className="text-[0.42em] tracking-normal text-muted">%</span>}
        </span>
        <span className="text-[13px] text-muted">{ok ? 'gap' : 'N/A'}</span>
      </span>
      <GapBar value={ok ? g.gapRate : null} />
      <span className="flex items-center justify-between gap-2 text-[13px] text-muted">
        <span className="num">
          <span className="font-semibold text-ink">{g.findings}</span> {g.findings === 1 ? 'finding' : 'findings'}
        </span>
        {d !== null && (
          <span className="inline-flex items-center gap-1" title={`Gap ${pct(g.gapRate)}% vs ${pct(g.prevGapRate)}% in Q4 2025`}>
            <Signed d={d} invert unit={false} />
            <span>vs Q4</span>
          </span>
        )}
      </span>
    </>
  );
}
