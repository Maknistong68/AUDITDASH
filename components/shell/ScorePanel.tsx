'use client';
import { ArrowDown, ArrowUp, ClipboardList, ThumbsUp, TriangleAlert, type LucideIcon } from 'lucide-react';
import { ScoreRing } from '@/components/charts/ScoreRing';
import { BandScale } from '@/components/charts/BandScale';
import { CountUp } from '@/components/motion/CountUp';
import { int, pts } from '@/lib/format';

interface Props { avgScore: number | null; delta: number | null; audits: number; negatives: number; positives: number }

function Counter({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 px-3 first:pl-0 last:pr-0">
      <span className="flex items-center gap-1.5 text-[12px] leading-4 text-muted">
        <Icon size={13} aria-hidden />
        {label}
      </span>
      <span className="text-[24px] font-semibold leading-7 tracking-[-0.02em]">
        <CountUp value={value} format={int} />
      </span>
    </div>
  );
}

/** Left column: score ring with band, change vs Q4, and three counters. */
export function ScorePanel({ avgScore, delta, audits, negatives, positives }: Props) {
  const up = delta !== null && delta > 0;
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-between gap-4">
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <ScoreRing value={avgScore} size={380} />
        {delta !== null && (
          <span
            className="num inline-flex items-center gap-1 rounded-full bg-raised px-2.5 py-1 text-[13px] font-medium"
            title="Q1 2026 average vs Q4 2025 average"
          >
            <span className="inline-flex items-center gap-0.5" style={{ color: delta === 0 ? 'var(--muted)' : up ? 'var(--positive)' : 'var(--negative)' }}>
              {delta !== 0 && (up ? <ArrowUp size={13} aria-hidden /> : <ArrowDown size={13} aria-hidden />)}
              {pts(delta)} pts
            </span>
            <span className="text-muted">vs Q4</span>
          </span>
        )}
        {avgScore !== null && <BandScale value={avgScore} />}
      </div>
      <div className="grid grid-cols-3 divide-x divide-rule border-t border-rule pt-4">
        <Counter icon={ClipboardList} label="Audits" value={audits} />
        <Counter icon={TriangleAlert} label="Findings" value={negatives} />
        <Counter icon={ThumbsUp} label="Positives" value={positives} />
      </div>
    </div>
  );
}
