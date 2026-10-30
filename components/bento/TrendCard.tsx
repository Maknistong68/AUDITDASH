'use client';
import { ScoreLine } from '@/components/charts/ScoreLine';
import type { MonthPoint } from '@/lib/analytics';
import { BentoCard, TileLabel } from './BentoGrid';
import { PAD, Signed } from './parts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const label = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

/**
 * The lower half of the dashboard's left column: the portfolio score month by month (average honest score of the
 * month's audits), first month to latest, with the change between them. Hover the chart for a month's audits.
 */
export function TrendCard({ points }: { points: MonthPoint[] }) {
  const first = points[0];
  const last = points.at(-1);
  const d = first && last && points.length > 1 ? Math.round(last.avg * 100) - Math.round(first.avg * 100) : null;
  return (
    <BentoCard i={1} testid="score-trend" className={`${PAD} gap-[clamp(4px,1svh,12px)]`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <TileLabel className="!text-ink">Score over time</TileLabel>
        {first && last && (
          <p className="flex items-baseline gap-2 text-[13px] text-muted">
            <span className="num">{label(first.month)} – {label(last.month)}</span>
            {d !== null && <Signed d={d} />}
          </p>
        )}
      </div>
      {points.length ? <ScoreLine points={points} /> : <p className="text-[14px] text-muted">No audits in this filter</p>}
    </BentoCard>
  );
}
