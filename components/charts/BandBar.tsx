'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { bandTone } from '@/lib/format';
import { BANDS } from '@/lib/scoring';
import type { Band } from '@/lib/types';

/** The segmented band bar (contractors per band, zeros left out). Used by the /audits bands panel. */
export function BandBar({ bands, className = 'h-[clamp(8px,1.1svh,12px)]' }: { bands: Record<Band, number>; className?: string }) {
  const reduce = useReducedMotion();
  const total = BANDS.reduce((s, b) => s + bands[b], 0);
  return (
    <div className={`flex ${className} w-full gap-[3px] overflow-hidden rounded-full`} role="img" aria-label={BANDS.map((b) => `${b} ${bands[b]}`).join(', ')}>
      {total === 0 && <span className="h-full w-full rounded-full bg-fill" />}
      {BANDS.filter((b) => bands[b] > 0).map((b, k) => (
        <motion.span
          key={b}
          className={`tone-${bandTone(b)} block h-full first:rounded-l-full last:rounded-r-full`}
          style={{ background: 'var(--tone-dot)', flexBasis: `${(bands[b] / total) * 100}%`, transformOrigin: 'left' }}
          initial={reduce ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.35 + k * 0.08 }}
        />
      ))}
    </div>
  );
}
