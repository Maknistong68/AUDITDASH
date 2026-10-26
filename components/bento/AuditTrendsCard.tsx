'use client';
import { QUARTERS as QUARTER_ORDER } from '@/lib/filters';
import { bandFor } from '@/lib/scoring';
import { bandTone, deltaPoints, pct } from '@/lib/format';
import type { Filter, Quarter, Subregion } from '@/lib/types';
import { BentoCard, TileLabel } from './BentoGrid';
import { PAD, ScoreBar, Signed, SubLabel } from './parts';

type Row = { region: Subregion; byQuarter: Record<Quarter, number | null> };

/** Shown value and Δ for one region under the quarter filter. Δ (vs the previous quarter) only when showing Q1+. */
function pick(r: Row, quarter: Filter['quarter']): { v: number | null; d: number | null } {
  const shown = quarter === 'all' ? (QUARTER_ORDER.filter((q) => r.byQuarter[q] !== null).at(-1) ?? null) : quarter;
  const v = shown ? r.byQuarter[shown] : null;
  const i = shown ? QUARTER_ORDER.indexOf(shown) : -1;
  const prev = i > 0 ? r.byQuarter[QUARTER_ORDER[i - 1]] : null;
  return { v, d: v !== null && prev !== null ? Math.round(v * 100) - Math.round(prev * 100) : null };
}

const qName = (q: Quarter) => q.replace('-', ' ');

/** One labelled bar row: label · band-toned score bar · (Δ) value. */
function TrendRow({ label, v, d, strong, testid, region }: { label: string; v: number | null; d?: number | null; strong?: boolean; testid?: string; region?: Subregion }) {
  const tone = v !== null ? bandTone(bandFor(v)) : null;
  return (
    <li data-testid={testid} data-region={region} className={`${tone ? `tone-${tone}` : ''} grid grid-cols-[4.2em_minmax(0,1fr)_auto] items-center gap-x-[clamp(8px,0.8vw,14px)]`}>
      <span className={`num whitespace-nowrap text-[13px] ${strong ? 'font-semibold text-ink' : 'text-muted'}`}>{label}</span>
      {v !== null ? <ScoreBar value={v} delay={0.4} /> : <span className="block h-[clamp(8px,1.1svh,12px)] rounded-full bg-fill-2" aria-hidden />}
      <span className="flex items-baseline justify-end gap-1.5">
        {d != null && <span className="text-[12px]"><Signed d={d} unit={false} /></span>}
        <span data-testid={region ? 'region-value' : undefined} className="figure min-w-[2.4em] text-right text-[clamp(18px,2.5svh,28px)]">
          {pct(v)}
          {v !== null && <span className="text-[0.5em] tracking-normal text-muted">%</span>}
        </span>
      </span>
    </li>
  );
}

/**
 * Audit trends: quarter over quarter (average official score per quarter, independent of the quarter filter)
 * and SR1 vs SR2 for the filtered quarter (under All: each region's latest quarter), Δ vs the quarter before.
 */
export function AuditTrendsCard({ byQuarter, rows, quarter }: {
  byQuarter: { quarter: Quarter; value: number | null }[]; rows: Row[]; quarter: Filter['quarter'];
}) {
  const picks = rows.map((r) => ({ r, ...pick(r, quarter) }));
  const anyDelta = picks.some((p) => p.d !== null);
  const scope = quarter === 'all' ? 'Latest quarter' : qName(quarter);
  const prevQ = quarter === 'all' ? 'Q4' : QUARTER_ORDER[QUARTER_ORDER.indexOf(quarter) - 1]?.slice(0, 2);
  return (
    <BentoCard i={3} testid="audit-trends" label="Audit trends" className={`${PAD} justify-between gap-[clamp(8px,1.4svh,16px)] min-[640px]:col-span-5`}>
      <TileLabel className="text-ink">Audit trends</TileLabel>
      <div data-testid="quarter-trend" className="flex flex-col gap-[clamp(4px,0.8svh,10px)]">
        <SubLabel>Quarter over quarter</SubLabel>
        <ul className="grid gap-[clamp(4px,0.9svh,10px)]">
          {byQuarter.map((q, k) => (
            <TrendRow
              key={q.quarter}
              label={qName(q.quarter)}
              v={q.value}
              d={k > 0 && q.value !== null ? deltaPoints(q.value, byQuarter[k - 1].value) : null}
              strong={quarter === q.quarter}
            />
          ))}
        </ul>
      </div>
      <div data-testid="region-compare" className="flex flex-col gap-[clamp(4px,0.8svh,10px)]">
        <div className="flex items-baseline justify-between gap-2">
          <SubLabel>Regions</SubLabel>
          <p data-testid="region-scope" className="truncate text-[12px] text-muted">{anyDelta && prevQ ? `${scope} · Δ vs ${prevQ}` : scope}</p>
        </div>
        <ul className="grid gap-[clamp(4px,0.9svh,10px)]">
          {picks.map(({ r, v, d }) => (
            <TrendRow key={r.region} testid="region-row" region={r.region} label={r.region} v={v} d={d} strong />
          ))}
          {rows.length === 0 && <li className="text-[13px] text-muted">No region selected</li>}
        </ul>
      </div>
    </BentoCard>
  );
}
