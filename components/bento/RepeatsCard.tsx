'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { Repeat2 } from 'lucide-react';
import { CountUp } from '@/components/motion/CountUp';
import { HandoffLink } from '@/components/motion/HandoffLink';
import { int } from '@/lib/format';
import { REPEATS_CARD, REPEATS_FIGURE } from '@/lib/handoff';
import { BentoCard, TileLabel } from './BentoGrid';
import { BIG, CardChevron, PAD } from './parts';

/** Segment fill: one warm hue, darker (stronger) as the reach widens. Index 0 is the widest reach. */
const SHADES = ['100%', '68%', '42%', '26%'];
const shade = (k: number) => `color-mix(in srgb, var(--tone-dot) ${SHADES[Math.min(k, SHADES.length - 1)]}, transparent)`;

/**
 * M: questions repeating at ≥5 of the 7 contractors audited in both quarters, scaled for a region filter (lib/analytics
 * systemicRepeats, repeatThreshold; the threshold is the tiny label under the meaning). Under the number, one stacked bar of how
 * widespread they are: a segment per reach (contractors hit, widest first), width ∝ questions at that reach, with a tiny
 * "6 at all 7" label (questions at reach) under each segment.
 * The whole tile opens /repeats with the shared hand-off: the tile grows into the view's header strip and the figure
 * flies into its header figure (lib/handoff).
 */
export function RepeatsCard({ repeats, spread, threshold, href }: {
  repeats: number | null; spread: Spread;
  /** The reach a question needed ("at ≥5 of 7 contractors"); null without an earlier quarter. */
  threshold: { min: number; of: number } | null;
  href: string;
}) {
  return (
    <BentoCard i={3} testid="kpi-repeats" handoff={REPEATS_CARD} className={`tone-minimal ${PAD} lift group justify-between gap-2 min-[640px]:col-span-3`}>
      <HandoffLink
        href={href}
        aria-label={`Repeat findings: ${repeats === null ? 'needs an earlier quarter' : `${repeats} questions repeating`}. Open details`}
        className="absolute inset-0 z-[1] rounded-[var(--radius-card)]"
      />
      <CardChevron />
      <TileLabel tone="var(--tone)">
        <Repeat2 size={16} strokeWidth={2.4} aria-hidden />
        Repeat findings
      </TileLabel>
      <div className="flex items-end gap-3">
        <p data-testid="repeats-count" data-handoff={REPEATS_FIGURE} className={BIG}>
          {repeats === null ? <span className="text-faint">—</span> : <CountUp value={repeats} format={int} duration={1.2} delay={0.3} />}
        </p>
        <p className="flex flex-col gap-1 pb-[0.5em] text-[13px] leading-tight text-muted">
          <span>{repeats === null ? 'Needs an earlier quarter' : 'questions repeating'}</span>
          {repeats !== null && threshold && threshold.of > 0 && (
            <ThresholdLabel min={threshold.min} of={threshold.of} />
          )}
        </p>
      </div>
      {repeats !== null && spread.length > 0 && <ReachBar spread={spread} />}
    </BentoCard>
  );
}

/** "at ≥5 of 7 contractors": the reach a question needed to count (lib/analytics repeatThreshold). Card and /repeats header. */
export function ThresholdLabel({ min, of }: { min: number; of: number }) {
  return (
    <span data-testid="repeats-threshold" className="whitespace-nowrap text-[11px] leading-none text-muted">
      at ≥{min} of {of} contractors
    </span>
  );
}

type Spread = { reach: number; of: number; questions: number }[];
const reachLabel = (s: { reach: number; of: number }) => (s.reach === s.of ? `all ${s.of}` : `${s.reach} of ${s.of}`);
/** Segment fills after the widest are washes of the orange: in light they get a >= 3:1 edge (--seg-edge, none in dark). */
const edge = (k: number) => (k === 0 ? undefined : 'inset 0 0 0 1.5px var(--seg-edge)');

/**
 * One stacked bar of how widespread the repeats are: a segment per reach (contractors hit, widest first), width ∝
 * questions at that reach, a tiny "6 at all 7" label under each (questions at reach). Shared by the card and the /repeats header.
 */
export function ReachBar({ spread }: { spread: Spread }) {
  const reduce = useReducedMotion();
  return (
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
          className={`block h-[clamp(8px,1.1svh,12px)] ${k === 0 ? 'rounded-l-full' : ''} ${k === spread.length - 1 ? 'rounded-r-full' : ''}`}
          style={{ background: shade(k), boxShadow: edge(k), transformOrigin: 'left' }}
          initial={reduce ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.35 + k * 0.08 }}
        />
      ))}
      {spread.map((s) => (
        <span key={s.reach} data-testid="repeats-segment-label" className="num whitespace-nowrap text-[11px] leading-none text-muted">
          <span className="font-semibold text-ink">{s.questions}</span> at {reachLabel(s)}
        </span>
      ))}
    </div>
  );
}
