'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { pct } from '@/lib/format';
import { EASE, DUR } from '@/lib/motion';

const SECTIONS = [
  { key: 'A', label: 'A Management' },
  { key: 'B', label: 'B Site processes' },
  { key: 'C', label: 'C Planning' },
] as const;

/**
 * The latest audit's A/B/C section scores (scored/possible) as three short bars on a 0–100% scale,
 * one hue, labelled. Null section = "—" with an empty track (never NaN).
 */
export function SectionBars({ rings, delay = 0 }: { rings: Record<'A' | 'B' | 'C', number | null>; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <ul className="grid gap-[clamp(4px,0.8svh,8px)]" aria-label="Section scores">
      {SECTIONS.map((s, i) => {
        const v = rings[s.key];
        const ok = v !== null && Number.isFinite(v);
        return (
          <li key={s.key} className="grid grid-cols-[minmax(0,8.5em)_minmax(0,1fr)_3ch] items-center gap-2.5 text-[13px]">
            <span className="truncate text-muted">{s.label}</span>
            <span className="relative h-[7px] overflow-hidden rounded-full bg-fill-2">
              {ok && (
                <motion.span
                  className="absolute inset-y-0 left-0 rounded-full bg-[var(--bar)]"
                  style={{ width: `${Math.min(1, Math.max(0, v)) * 100}%`, transformOrigin: 'left' }}
                  initial={reduce ? false : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ type: 'tween', ease: EASE, duration: DUR, delay: delay + i * 0.06 }}
                />
              )}
            </span>
            <span className="num text-right font-semibold">{pct(v)}</span>
          </li>
        );
      })}
    </ul>
  );
}
