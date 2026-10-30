'use client';
import { QuarterLines } from '@/components/charts/QuarterLines';
import type { QuarterLine } from '@/lib/analytics';
import { deltaPoints } from '@/lib/format';
import type { Quarter } from '@/lib/types';
import { BentoCard, TileLabel } from './BentoGrid';
import { PAD } from './parts';

/**
 * The lower half of the dashboard's left column: every contractor's score from one quarter to the next, with the
 * portfolio average as the bold line. The header counts who improved and who declined.
 */
export function TrendCard({ quarters, portfolio, lines }: { quarters: Quarter[]; portfolio: (number | null)[]; lines: QuarterLine[] }) {
  const moves = lines.flatMap((l) => {
    const xs = l.values.filter((v): v is number => v !== null);
    return xs.length > 1 ? [deltaPoints(xs[xs.length - 1], xs[xs.length - 2])!] : [];
  });
  const up = moves.filter((d) => d > 0).length;
  const down = moves.filter((d) => d < 0).length;
  return (
    <BentoCard i={1} testid="score-trend" className={`${PAD} gap-[clamp(4px,1svh,12px)]`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <TileLabel className="!text-ink">Score by quarter</TileLabel>
        {moves.length > 0 && (
          <p className="flex items-baseline gap-3 text-[13px]" data-testid="quarter-moves">
            <span><span className="num font-semibold" style={{ color: 'var(--up)' }}>{up}</span> <span className="text-muted">up</span></span>
            <span><span className="num font-semibold" style={{ color: 'var(--down)' }}>{down}</span> <span className="text-muted">down</span></span>
          </p>
        )}
      </div>
      {quarters.length ? <QuarterLines quarters={quarters} portfolio={portfolio} lines={lines} /> : <p className="text-[14px] text-muted">No audits</p>}
    </BentoCard>
  );
}
