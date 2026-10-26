'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { Repeat2 } from 'lucide-react';
import { CountUp } from '@/components/motion/CountUp';
import { int } from '@/lib/format';
import { BentoCard, TileLabel } from './BentoGrid';
import { BIG, PAD } from './parts';

/**
 * M: questions repeating at ≥5 contractors (lib/analytics systemicRepeats). Under the number, the top 5 as dot rows:
 * one dot per contractor audited in both quarters, filled where the question repeated. No codes, no text.
 */
export function RepeatsCard({ repeats, top }: {
  repeats: number | null; top: { itemCode: string; hit: number; of: number }[];
}) {
  const reduce = useReducedMotion();
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
      {repeats !== null && top.length > 0 && (
        <ul
          data-testid="repeats-dots"
          role="img"
          aria-label={`Top ${top.length} repeating issues across contractors: ${top.map((t) => `${t.hit} of ${t.of}`).join(', ')}`}
          className="grid gap-[clamp(3px,0.6svh,7px)]"
        >
          {top.map((t, r) => (
            <li key={t.itemCode} data-testid="repeats-dot-row" className="flex gap-[clamp(4px,0.4vw,7px)]">
              {Array.from({ length: t.of }, (_, k) => (
                <motion.span
                  key={k}
                  data-filled={k < t.hit ? '' : undefined}
                  className="block size-[clamp(6px,0.95svh,10px)] rounded-full"
                  style={{ background: k < t.hit ? 'var(--tone-dot)' : 'var(--fill)' }}
                  initial={reduce ? false : { scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.4 + r * 0.06 + k * 0.03 }}
                />
              ))}
            </li>
          ))}
        </ul>
      )}
    </BentoCard>
  );
}
