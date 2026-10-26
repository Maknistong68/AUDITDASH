'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { Repeat2 } from 'lucide-react';
import { CountUp } from '@/components/motion/CountUp';
import { int } from '@/lib/format';
import { BentoCard, TileLabel } from './BentoGrid';
import { BIG, PAD } from './parts';

/** Segment fill: one warm hue, darker (stronger) as the reach widens. Index 0 is the widest reach. */
const SHADES = ['100%', '68%', '42%', '26%'];
const shade = (k: number) => `color-mix(in srgb, var(--tone-dot) ${SHADES[Math.min(k, SHADES.length - 1)]}, transparent)`;

/**
 * M: questions repeating at ≥5 contractors (lib/analytics systemicRepeats). Under the number, one stacked bar of how
 * widespread they are: a segment per reach (contractors hit, widest first), width ∝ questions at that reach, with a tiny
 * "questions · reach" label under each segment.
 */
export function RepeatsCard({ repeats, spread }: {
  repeats: number | null; spread: { reach: number; of: number; questions: number }[];
}) {
  const reduce = useReducedMotion();
  const reachLabel = (s: { reach: number; of: number }) => (s.reach === s.of ? `all ${s.of}` : `${s.reach} of ${s.of}`);
  return (
    <BentoCard i={3} testid="kpi-repeats" className={`tone-minimal ${PAD} justify-between gap-2 min-[640px]:col-span-3`}>
      <TileLabel tone="var(--tone)">
        <Repeat2 size={16} strokeWidth={2.4} aria-hidden />
        Repeat findings
      </TileLabel>
      <div className="flex items-end gap-3">
        <p data-testid="repeats-count" className={BIG}>
          {repeats === null ? <span className="text-faint">—</span> : <CountUp value={repeats} format={int} duration={1.2} delay={0.3} />}
        </p>
        <p className="pb-[0.5em] text-[13px] leading-tight text-muted">{repeats === null ? 'Needs an earlier quarter' : 'questions repeating'}</p>
      </div>
      {repeats !== null && spread.length > 0 && (
        <div
          data-testid="repeats-spread"
          role="img"
          aria-label={`How widespread: ${spread.map((s) => `${s.questions} at ${reachLabel(s)} contractors`).join(', ')}`}
          className="grid gap-x-[3px] gap-y-1.5"
          style={{ gridTemplateColumns: spread.map((s) => `minmax(max-content, ${s.questions}fr)`).join(' ') }}
        >
          {spread.map((s, k) => (
            <motion.span
              key={s.reach}
              data-testid="repeats-segment"
              data-reach={s.reach}
              data-questions={s.questions}
              className="block h-[clamp(8px,1.1svh,12px)] first:rounded-l-full last:rounded-r-full"
              style={{ background: shade(k), transformOrigin: 'left' }}
              initial={reduce ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.35 + k * 0.08 }}
            />
          ))}
          {spread.map((s) => (
            <span key={s.reach} data-testid="repeats-segment-label" className="num whitespace-nowrap text-[11px] leading-none text-muted">
              <span className="font-semibold text-ink">{s.questions}</span> · {reachLabel(s)}
            </span>
          ))}
        </div>
      )}
    </BentoCard>
  );
}
