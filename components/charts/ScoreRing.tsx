'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { bandFor } from '@/lib/scoring';
import { bandColor, pct } from '@/lib/format';
import { CountUp } from '@/components/motion/CountUp';

const BAND_EDGES = [0.6, 0.7, 0.8, 0.9];
const fmt = (n: number) => String(Math.round(n));

/**
 * Score ring: arc length = score (0..1), stroke in the band colour, band thresholds notched into the track.
 * value === null draws an empty track and a dash (no NaN). The figure counts up; instant under reduced motion.
 */
export function ScoreRing({ value, size, label }: { value: number | null; size: number; label?: string }) {
  const reduce = useReducedMotion();
  const ok = value !== null && Number.isFinite(value);
  const v = ok ? Math.min(1, Math.max(0, value)) : 0;
  const band = ok ? bandFor(v) : null;
  const color = band ? bandColor(band) : 'var(--faint)';
  const stroke = Math.round(size * 0.075);
  const r = (size - stroke) / 2;
  const c = size / 2;

  return (
    <figure
      data-testid="score-ring"
      className="flex w-full flex-col items-center gap-3"
      aria-label={ok ? `Portfolio score ${pct(v)}%${band ? `, ${band}` : ''}` : 'No score'}
    >
      <div className="relative aspect-square" style={{ width: `min(100%, ${size}px, 40svh)` }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="block size-full -rotate-90" aria-hidden>
          <circle cx={c} cy={c} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
          {BAND_EDGES.map((e) => {
            const a = e * 2 * Math.PI;
            const r1 = r - stroke / 2 - 1;
            const r2 = r + stroke / 2 + 1;
            return (
              <line
                key={e}
                x1={c + r1 * Math.cos(a)}
                y1={c + r1 * Math.sin(a)}
                x2={c + r2 * Math.cos(a)}
                y2={c + r2 * Math.sin(a)}
                stroke="var(--surface)"
                strokeWidth={2}
              />
            );
          })}
          {ok && (
            <motion.circle
              key={band}
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: v }}
              transition={{ duration: reduce ? 0 : 1.2, ease: [0.16, 1, 0.3, 1] }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-semibold leading-none tracking-[-0.03em]" style={{ fontSize: 'clamp(40px, 7.5svh, 72px)' }}>
            {ok ? <CountUp value={v * 100} format={fmt} /> : <span className="text-faint">—</span>}
            {ok && <span className="ml-0.5 align-top text-[0.42em] font-medium text-muted">%</span>}
          </span>
        </div>
      </div>
      {(label ?? band) && (
        <figcaption className="flex items-center gap-2 text-[15px] font-medium">
          <span className="size-2.5 rounded-full" style={{ background: color }} aria-hidden />
          {label ?? band}
        </figcaption>
      )}
    </figure>
  );
}
