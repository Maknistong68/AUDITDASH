'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { bandFor } from '@/lib/scoring';
import { bandColor } from '@/lib/format';
import type { Band } from '@/lib/types';

/** The five bands, worst to best, with their lower edges (score fraction). */
const BANDS: { band: Band; from: number; to: number }[] = [
  { band: 'Non-Compliant', from: 0.5, to: 0.6 },
  { band: 'Minimally Compliant', from: 0.6, to: 0.7 },
  { band: 'Partially Compliant', from: 0.7, to: 0.8 },
  { band: 'Good', from: 0.8, to: 0.9 },
  { band: 'Excellent', from: 0.9, to: 1 },
];

/**
 * Band ladder: five equal segments (the lowest drawn from 50%), the current band at full strength,
 * a marker at the score. Doubles as the colour key for the league bars.
 */
export function BandScale({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const current = bandFor(value);
  const clamped = Math.min(1, Math.max(0.5, value));
  const pos = ((clamped - 0.5) / 0.5) * 100;
  return (
    <div className="w-full max-w-[320px]" role="img" aria-label={`Band scale, current band ${current}`}>
      <div className="relative h-3">
        <motion.span
          className="absolute top-0 h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[6px] border-x-transparent border-t-[var(--text)]"
          initial={reduce ? false : { left: '0%' }}
          animate={{ left: `${pos}%` }}
          transition={{ duration: reduce ? 0 : 1.2, ease: [0.16, 1, 0.3, 1] }}
          aria-hidden
        />
      </div>
      <div className="flex gap-[2px]">
        {BANDS.map((b) => (
          <span
            key={b.band}
            title={b.band}
            className="h-2 flex-1 first:rounded-l-full last:rounded-r-full"
            style={{ background: bandColor(b.band), opacity: b.band === current ? 1 : 0.28 }}
          />
        ))}
      </div>
      <div className="num relative mt-1 h-4 text-[11px] leading-4 text-muted" aria-hidden>
        {[60, 70, 80, 90].map((n, i) => (
          <span key={n} className="absolute -translate-x-1/2" style={{ left: `${(i + 1) * 20}%` }}>{n}</span>
        ))}
      </div>
    </div>
  );
}
