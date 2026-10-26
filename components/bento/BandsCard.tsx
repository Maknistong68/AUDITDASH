'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { HandoffLink } from '@/components/motion/HandoffLink';
import { bandShort, bandTone } from '@/lib/format';
import { BANDS_CARD } from '@/lib/handoff';
import type { Band } from '@/lib/types';
import { BentoCard, TileLabel } from './BentoGrid';
import { CardChevron, PAD } from './parts';

export const BANDS: Band[] = ['Excellent', 'Good', 'Partially Compliant', 'Minimally Compliant', 'Non-Compliant'];

/**
 * S: contractors per band — segmented bar and the five counts (zeros grey). The whole tile opens /audits?focus=bands with
 * the shared hand-off: the tile grows into the view's bands panel (lib/handoff).
 */
export function BandsCard({ bands, href }: { bands: Record<Band, number>; href: string }) {
  return (
    <BentoCard i={5} testid="kpi-bands" handoff={BANDS_CARD} className={`${PAD} lift group justify-between gap-2 min-[640px]:col-span-2`}>
      <HandoffLink href={href} aria-label="Contractors by band. Open portfolio" className="absolute inset-0 z-[1] rounded-[var(--radius-card)]" />
      <CardChevron small />
      <TileLabel>Contractors by band</TileLabel>
      <BandBar bands={bands} />
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

/** The segmented band bar (contractors per band, zeros left out). Shared by the card and the /audits bands panel. */
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
