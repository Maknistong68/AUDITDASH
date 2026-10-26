'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowUp } from 'lucide-react';

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

/** A smaller display figure for the counts that share one card. */
export const MID = 'figure text-[clamp(36px,5.6svh,68px)]';

/** A block label inside a merged card (one step quieter than the tile label). */
export function SubLabel({ children, tone, className = '' }: { children: React.ReactNode; tone?: string; className?: string }) {
  return (
    <h3 className={`flex items-center gap-1.5 text-[13px] font-semibold leading-tight ${className}`} style={{ color: tone ?? 'var(--muted)' }}>
      {children}
    </h3>
  );
}
