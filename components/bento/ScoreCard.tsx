'use client';
import { CountUp } from '@/components/motion/CountUp';
import { HandoffLink } from '@/components/motion/HandoffLink';
import { TrendChart } from '@/components/charts/Trend';
import { bandShort, bandTone, int, pct } from '@/lib/format';
import { PORTFOLIO_CARD, PORTFOLIO_FIGURE } from '@/lib/handoff';
import type { Band } from '@/lib/types';
import { BentoCard, TileLabel } from './BentoGrid';
import { BIG, CardChevron, PAD, ScoreBar, whole } from './parts';

/**
 * M: portfolio score (average official score over the filtered audits), its band, and a small up/down chart of the
 * portfolio average per quarter (Q4 2025 → Q1 2026; green when it rose, red when it fell). The whole tile opens /audits
 * with the shared hand-off: the tile grows into the view's header strip and the figure flies into its header figure
 * (lib/handoff). Bands and regions live on that page only.
 */
export function ScoreCard({ avgScore, band, audits, byQuarter, href }: {
  avgScore: number | null; band: Band | null; audits: number;
  byQuarter: { label: string; value: number | null }[]; href: string;
}) {
  const ok = avgScore !== null && Number.isFinite(avgScore);
  const points = byQuarter.filter((q): q is { label: string; value: number } => q.value !== null && Number.isFinite(q.value));
  return (
    <BentoCard i={2} testid="kpi-score" handoff={PORTFOLIO_CARD} className={`${PAD} lift group gap-2 min-[640px]:col-span-3 ${band ? `tone-${bandTone(band)}` : ''}`}>
      <HandoffLink
        href={href}
        aria-label={`Portfolio score: ${ok ? `${pct(avgScore)}%` : 'no score'}. Open portfolio`}
        className="absolute inset-0 z-[1] rounded-[var(--radius-card)]"
      />
      <CardChevron />
      <TileLabel>Portfolio score · {int(audits)} audits</TileLabel>
      {/* The chart takes the height the row gives the tile, so a taller screen draws a taller chart (no empty band). */}
      <div data-testid="score-ring" className="flex min-h-0 flex-1 flex-col justify-end gap-[clamp(6px,1.2svh,14px)]">
        <div className="flex min-h-0 flex-1 items-end justify-between gap-3">
          <p data-handoff={PORTFOLIO_FIGURE} className={`${BIG} shrink-0`} aria-label={ok ? `${pct(avgScore)} percent` : 'No score'}>
            {ok ? <CountUp value={avgScore! * 100} format={whole} duration={1.2} delay={0.25} /> : <span className="text-faint">—</span>}
            {ok && <span className="ml-0.5 text-[0.46em] tracking-normal text-muted">%</span>}
          </p>
          <div className="flex h-full max-h-[200px] min-h-0 min-w-0 max-w-[300px] flex-1 flex-col items-end justify-end gap-1 text-[13px]">
            {band && <span className="badge px-2 py-[2px]" title={band}>{bandShort(band)}</span>}
            {points.length > 0 && <TrendChart points={points} className="min-h-[46px] w-full min-w-[104px] flex-1" />}
          </div>
        </div>
        {ok && <ScoreBar value={avgScore!} delay={0.3} />}
      </div>
    </BentoCard>
  );
}
