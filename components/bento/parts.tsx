'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowUp, ChevronRight } from 'lucide-react';

export const whole = (n: number) => String(Math.round(n));
export const PAD = 'px-[clamp(16px,1.5vw,28px)] py-[clamp(12px,1.8svh,24px)]';
export const BIG = 'figure text-[clamp(44px,7.4svh,88px)]';

/** Signed whole-point change; colour says good/bad (invert for metrics where falling is good). */
export function Signed({ d, unit = true, invert = false }: { d: number; unit?: boolean; invert?: boolean }) {
  const good = invert ? d < 0 : d > 0;
  const bad = invert ? d > 0 : d < 0;
  return (
    <span className="num inline-flex items-center gap-0.5 font-semibold" style={{ color: good ? 'var(--up)' : bad ? 'var(--down)' : 'var(--muted)' }}>
      {d > 0 && <ArrowUp size={13} strokeWidth={2.6} aria-hidden />}
      {d < 0 && <ArrowDown size={13} strokeWidth={2.6} aria-hidden />}
      {d > 0 ? '+' : d < 0 ? '−' : '±'}
      {Math.abs(d)}
      {unit && ` ${Math.abs(d) === 1 ? 'pt' : 'pts'}`}
    </span>
  );
}

/** A 0–100% bar with band thresholds notched in; fill in the band tone. */
export function ScoreBar({ value, delay }: { value: number; delay: number }) {
  const reduce = useReducedMotion();
  return (
    <span className="relative block h-[clamp(8px,1.1svh,12px)] w-full rounded-full bg-fill-2" aria-hidden>
      {[0.6, 0.7, 0.8, 0.9].map((t) => (
        <span key={t} className="absolute inset-y-0 w-[2px] -translate-x-1/2 bg-surface" style={{ left: `${t * 100}%` }} />
      ))}
      <motion.span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${Math.min(1, Math.max(0, value)) * 100}%`, background: 'var(--tone-dot)', transformOrigin: 'left' }}
        initial={reduce ? false : { scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20, delay }}
      />
    </span>
  );
}

/**
 * The subtle "opens" chevron in a clickable tile's top-right corner. `small`: a bare chevron inside the corner padding, for
 * the small tiles whose label runs nearly to the edge (it never overlaps or reflows the label).
 */
export function CardChevron({ small = false }: { small?: boolean }) {
  return small ? (
    <span
      aria-hidden
      data-testid="card-chevron"
      className="absolute right-[clamp(3px,0.4vw,8px)] top-[calc(clamp(12px,1.8svh,24px)+0.5*clamp(13px,1.5svh,16px)*1.5)] grid -translate-y-1/2 place-items-center text-faint transition-transform duration-300 group-hover:translate-x-0.5"
    >
      <ChevronRight size={14} strokeWidth={2.6} />
    </span>
  ) : (
    <span
      aria-hidden
      data-testid="card-chevron"
      className="absolute right-[clamp(12px,1.4svh,20px)] top-[clamp(10px,1.4svh,18px)] grid size-7 place-items-center rounded-full bg-fill-2 text-muted transition-transform duration-300 group-hover:translate-x-0.5"
    >
      <ChevronRight size={16} strokeWidth={2.4} />
    </span>
  );
}
