'use client';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { CountUp } from '@/components/motion/CountUp';
import { BandRuler } from '@/components/charts/BandRuler';
import { int, pts } from '@/lib/format';
import type { Band } from '@/lib/types';

interface Props {
  avgScore: number | null; band: Band | null; delta: number | null;
  audits: number; negatives: number; positives: number; scope: string;
}

const whole = (n: number) => String(Math.round(n));

/** Left column: the portfolio score as a giant editorial numeral, band, change vs Q4, band ruler, stats foot. */
export function ScoreBlock({ avgScore, band, delta, audits, negatives, positives, scope }: Props) {
  const ok = avgScore !== null && Number.isFinite(avgScore);
  const d = delta === null ? null : Math.round(delta * 100);
  return (
    <section data-testid="score-ring" aria-labelledby="score-title" className="flex min-h-0 min-w-0 flex-col">
      <h2 id="score-title" className="kicker">Portfolio score · {scope}</h2>
      <div className="flex flex-1 flex-col justify-center gap-[clamp(10px,2svh,24px)] py-4">
        <p
          className="font-display leading-[0.82] tracking-[-0.03em] text-ink"
          style={{ fontSize: 'clamp(112px, 25svh, 272px)' }}
          aria-label={ok ? `${whole(avgScore! * 100)} percent` : 'No score'}
        >
          {ok ? <CountUp value={avgScore! * 100} format={whole} duration={1.2} /> : <span className="text-faint">—</span>}
          {ok && <span className="ml-1 align-top text-[0.36em] leading-none text-muted">%</span>}
        </p>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          {band && <p className="text-[clamp(18px,2.4svh,22px)] font-medium tracking-[-0.01em]">{band}</p>}
          {d !== null && (
            <p className="num inline-flex items-center gap-1 text-[15px]" title="Q1 2026 average vs Q4 2025 average">
              <span
                className="inline-flex items-center gap-0.5 font-semibold"
                style={{ color: d === 0 ? 'var(--muted)' : d > 0 ? 'var(--positive)' : 'var(--gap-hue)' }}
              >
                {d > 0 && <ArrowUp size={15} aria-hidden />}
                {d < 0 && <ArrowDown size={15} aria-hidden />}
                {pts(delta!)} {Math.abs(d) === 1 ? 'pt' : 'pts'}
              </span>
              <span className="text-muted">vs Q4 2025</span>
            </p>
          )}
        </div>
        {ok && <BandRuler value={avgScore!} delay={0.1} />}
      </div>
      <p className="num flex flex-wrap gap-x-6 gap-y-1 border-t border-rule pt-4 text-[15px] text-muted">
        <span><span className="font-semibold text-ink"><CountUp value={audits} format={int} delay={0.1} /></span> audits</span>
        <span><span className="font-semibold text-ink"><CountUp value={negatives} format={int} delay={0.1} /></span> findings</span>
        <span><span className="font-semibold text-ink"><CountUp value={positives} format={int} delay={0.1} /></span> positives</span>
      </p>
    </section>
  );
}
