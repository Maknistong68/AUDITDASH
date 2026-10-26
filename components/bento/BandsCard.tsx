'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { bandShort, bandTone } from '@/lib/format';
import type { Band } from '@/lib/types';
import { BentoCard, TileLabel } from './BentoGrid';
import { PAD } from './parts';

const BANDS: Band[] = ['Excellent', 'Good', 'Partially Compliant', 'Minimally Compliant', 'Non-Compliant'];

/** S: contractors per band — segmented bar and the five counts (zeros grey). */
export function BandsCard({ bands }: { bands: Record<Band, number> }) {
  const reduce = useReducedMotion();
  const total = BANDS.reduce((s, b) => s + bands[b], 0);
  return (
    <BentoCard i={5} testid="kpi-bands" className={`${PAD} justify-between gap-2 min-[640px]:col-span-2`}>
      <TileLabel>Contractors by band</TileLabel>
      <div className="flex h-[clamp(8px,1.1svh,12px)] w-full gap-[3px] overflow-hidden rounded-full" role="img" aria-label={BANDS.map((b) => `${b} ${bands[b]}`).join(', ')}>
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
      <ul className="grid gap-[clamp(1px,0.35svh,4px)]">
        {BANDS.map((b) => {
          const n = bands[b];
          return (
            <li key={b} className={`tone-${bandTone(b)} flex items-center justify-between gap-2 text-[13px]`} title={b}>
              <span className="flex items-center gap-1.5 text-muted">
                <span className="size-[7px] rounded-full" style={{ background: 'var(--tone-dot)', opacity: n === 0 ? 0.35 : 1 }} aria-hidden />
                {bandShort(b)}
              </span>
              <span className={`num font-semibold ${n === 0 ? 'text-faint' : ''}`}>{n}</span>
            </li>
          );
        })}
      </ul>
    </BentoCard>
  );
}
