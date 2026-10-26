'use client';
import { HandoffLink } from '@/components/motion/HandoffLink';
import { QUARTERS as QUARTER_ORDER } from '@/lib/filters';
import { REGIONS_CARD } from '@/lib/handoff';
import { bandFor } from '@/lib/scoring';
import { bandTone, pct } from '@/lib/format';
import type { Filter, Quarter, Subregion } from '@/lib/types';
import { BentoCard, TileLabel } from './BentoGrid';
import { CardChevron, PAD, ScoreBar, Signed } from './parts';

type Row = { region: Subregion; byQuarter: Record<Quarter, number | null> };

/** Shown value and Δ for one region under the quarter filter. Δ (vs the previous quarter) only when showing Q1+. */
function pick(r: Row, quarter: Filter['quarter']): { v: number | null; shown: Quarter | null; d: number | null } {
  const shown = quarter === 'all' ? (QUARTER_ORDER.filter((q) => r.byQuarter[q] !== null).at(-1) ?? null) : quarter;
  const v = shown ? r.byQuarter[shown] : null;
  const i = shown ? QUARTER_ORDER.indexOf(shown) : -1;
  const prev = i > 0 ? r.byQuarter[QUARTER_ORDER[i - 1]] : null;
  return { v, shown, d: v !== null && prev !== null ? Math.round(v * 100) - Math.round(prev * 100) : null };
}

const qName = (q: Quarter) => q.replace('-', ' ');

/**
 * S: SR1 vs SR2 — average official score per region for the filtered quarter (under All: each region's latest
 * quarter), with Δ vs the quarter before when there is one. The footer names exactly what is shown.
 * The whole tile opens /audits?focus=regions with the shared hand-off: the tile grows into the view's region panel.
 */
export function RegionCard({ rows, quarter, href }: { rows: Row[]; quarter: Filter['quarter']; href: string }) {
  const picks = rows.map((r) => ({ r, ...pick(r, quarter) }));
  const anyDelta = picks.some((p) => p.d !== null);
  const scope = quarter === 'all' ? 'Latest quarter' : qName(quarter);
  const prevQ = quarter === 'all' ? 'Q4' : QUARTER_ORDER[QUARTER_ORDER.indexOf(quarter) - 1]?.slice(0, 2);
  return (
    <BentoCard i={6} testid="region-compare" handoff={REGIONS_CARD} className={`${PAD} lift group justify-between gap-2 min-[640px]:col-span-2`}>
      <HandoffLink href={href} aria-label="Region average score. Open portfolio" className="absolute inset-0 z-[1] rounded-[var(--radius-card)]" />
      <CardChevron small />
      <TileLabel>Region · average score</TileLabel>
      <ul className="grid gap-[clamp(8px,1.6svh,16px)]">
        {picks.map(({ r, v, d }) => {
          const tone = v !== null ? bandTone(bandFor(v)) : null;
          return (
            <li key={r.region} data-testid="region-row" data-region={r.region} className={`${tone ? `tone-${tone}` : ''} grid gap-1.5`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[14px] font-semibold">{r.region}</span>
                <span className="flex items-baseline gap-2">
                  {d !== null && <span className="text-[12px]"><Signed d={d} unit={false} /></span>}
                  <span data-testid="region-value" className="figure text-[clamp(20px,2.8svh,30px)]">
                    {pct(v)}
                    {v !== null && <span className="text-[0.5em] tracking-normal text-muted">%</span>}
                  </span>
                </span>
              </div>
              {v !== null ? <ScoreBar value={v} delay={0.4} /> : <span className="block h-[clamp(8px,1.1svh,12px)] rounded-full bg-fill-2" />}
            </li>
          );
        })}
        {rows.length === 0 && <li className="text-[13px] text-muted">No region selected</li>}
      </ul>
      <p data-testid="region-scope" className="text-[12px] text-muted">{anyDelta && prevQ ? `${scope} · Δ vs ${prevQ}` : scope}</p>
    </BentoCard>
  );
}
