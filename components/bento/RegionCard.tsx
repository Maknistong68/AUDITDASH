'use client';
import { QUARTERS as QUARTER_ORDER } from '@/lib/filters';
import { bandFor } from '@/lib/scoring';
import { bandTone, pct } from '@/lib/format';
import type { Quarter, Subregion } from '@/lib/types';
import { BentoCard, TileLabel } from './BentoGrid';
import { PAD, ScoreBar, Signed } from './parts';

/** S: SR1 vs SR2 — average score per region in its latest quarter, Δ vs the quarter before. */
export function RegionCard({ rows }: { rows: { region: Subregion; byQuarter: Record<Quarter, number | null> }[] }) {
  return (
    <BentoCard i={6} testid="region-compare" className={`${PAD} justify-between gap-2 min-[640px]:col-span-2`}>
      <TileLabel>Region · average score</TileLabel>
      <ul className="grid gap-[clamp(8px,1.6svh,16px)]">
        {rows.map((r) => {
          const qs = QUARTER_ORDER.filter((q) => r.byQuarter[q] !== null);
          const last = qs.at(-1);
          const v = last ? r.byQuarter[last] : null;
          const prev = qs.length > 1 ? r.byQuarter[qs[qs.length - 2]] : null;
          const d = v !== null && prev !== null ? Math.round(v * 100) - Math.round(prev * 100) : null;
          const tone = v !== null ? bandTone(bandFor(v)) : null;
          return (
            <li key={r.region} className={`${tone ? `tone-${tone}` : ''} grid gap-1.5`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[14px] font-semibold">{r.region}</span>
                <span className="flex items-baseline gap-2">
                  {d !== null && <span className="text-[12px]"><Signed d={d} unit={false} /></span>}
                  <span className="figure text-[clamp(20px,2.8svh,30px)]">
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
      <p className="text-[12px] text-muted">{rows.length && rows.some((r) => QUARTER_ORDER.filter((q) => r.byQuarter[q] !== null).length > 1) ? 'Latest quarter · Δ vs Q4' : 'Latest quarter'}</p>
    </BentoCard>
  );
}
