'use client';
import { CountUp } from '@/components/motion/CountUp';
import { HandoffLink } from '@/components/motion/HandoffLink';
import { bandShort, bandTone, deltaPoints, int, pct } from '@/lib/format';
import { PORTFOLIO_CARD, PORTFOLIO_FIGURE } from '@/lib/handoff';
import type { Band, Filter } from '@/lib/types';
import { BentoCard, TileLabel } from './BentoGrid';
import { BIG, CardChevron, PAD, ScoreBar, Signed, whole } from './parts';

/**
 * M: portfolio score (average official score over the filtered audits). The whole tile opens /audits with the shared
 * hand-off: the tile grows into the view's header strip and the figure flies into its header figure (lib/handoff).
 */
export function ScoreCard({ avgScore, band, delta, audits, quarter, byQuarter, href }: {
  avgScore: number | null; band: Band | null; delta: number | null; audits: number; quarter: Filter['quarter'];
  byQuarter: { label: string; value: number | null }[]; href: string;
}) {
  const ok = avgScore !== null && Number.isFinite(avgScore);
  // The delta is the difference of the quarter averages as displayed (each rounded first), so it always matches them.
  const q1 = byQuarter.find((q) => q.label === 'Q1 2026')?.value ?? null;
  const q4 = byQuarter.find((q) => q.label === 'Q4 2025')?.value ?? null;
  const d = delta === null || q1 === null ? null : deltaPoints(q1, q4);
  return (
    <BentoCard i={2} testid="kpi-score" handoff={PORTFOLIO_CARD} className={`${PAD} lift group justify-between gap-2 min-[640px]:col-span-3 ${band ? `tone-${bandTone(band)}` : ''}`}>
      <HandoffLink
        href={href}
        aria-label={`Portfolio score: ${ok ? `${pct(avgScore)}%` : 'no score'}. Open portfolio`}
        className="absolute inset-0 z-[1] rounded-[var(--radius-card)]"
      />
      <CardChevron />
      <TileLabel>Portfolio score · {int(audits)} audits</TileLabel>
      <div data-testid="score-ring" className="flex flex-col gap-[clamp(6px,1.2svh,14px)]">
        <div className="flex items-end justify-between gap-3">
          <p data-handoff={PORTFOLIO_FIGURE} className={BIG} aria-label={ok ? `${pct(avgScore)} percent` : 'No score'}>
            {ok ? <CountUp value={avgScore! * 100} format={whole} duration={1.2} delay={0.25} /> : <span className="text-faint">—</span>}
            {ok && <span className="ml-0.5 text-[0.46em] tracking-normal text-muted">%</span>}
          </p>
          <div className="flex flex-col items-end gap-1 pb-[0.35em] text-[13px]">
            {band && <span className="badge px-2 py-[2px]" title={band}>{bandShort(band)}</span>}
            {d !== null && (
              <span data-testid="kpi-score-delta" className="num inline-flex items-center gap-1" title="Average of Q1 2026 audits minus average of Q4 2025 audits">
                {quarter === 'all' && <span className="text-muted">Q1 vs Q4</span>}
                <Signed d={d} />
                {quarter !== 'all' && <span className="text-muted">vs Q4 2025</span>}
              </span>
            )}
          </div>
        </div>
        {ok && <ScoreBar value={avgScore!} delay={0.3} />}
        {quarter === 'all' && byQuarter.length > 1 && (
          <p className="num flex gap-4 text-[13px] text-muted">
            {byQuarter.map((q) => (
              <span key={q.label}>
                {q.label} <span className="font-semibold text-ink">{pct(q.value)}%</span>
              </span>
            ))}
          </p>
        )}
      </div>
    </BentoCard>
  );
}
