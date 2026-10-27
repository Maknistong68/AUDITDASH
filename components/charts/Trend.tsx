'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { deltaPoints, pct } from '@/lib/format';

export type TrendDir = 'up' | 'down' | 'flat' | 'single';

/** Up (green) only when the latest whole % beats the one before; down (red) when it is lower; one value or no change: grey. */
export function trendOf(values: number[]): TrendDir {
  if (values.length < 2) return 'single';
  const d = deltaPoints(values[values.length - 1], values[values.length - 2]);
  return d === null || d === 0 ? 'flat' : d > 0 ? 'up' : 'down';
}

export const TREND_COLOR: Record<TrendDir, string> = {
  up: 'var(--up)',
  down: 'var(--down)',
  flat: 'var(--muted)',
  single: 'var(--muted)',
};

/** Vertical position (0 top … 1 bottom) of each value inside its own min–max range; all equal: the middle. */
function ys(values: number[]): number[] {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return values.map((v) => (hi === lo ? 0.5 : 1 - (v - lo) / (hi - lo)));
}

/** "74% → 85%": the scores in order, for screen readers. */
export const trendLabel = (values: number[]) => values.map((v) => `${pct(v)}%`).join(' → ');

/**
 * A row sparkline: one point per audit score in date order, the latest dot emphasised. Green when the latest score rose
 * over the previous one, red when it fell, grey for a single audit (one dot) or no change.
 */
export function Sparkline({ values, width = 56, height = 20, delay = 0 }: { values: number[]; width?: number; height?: number; delay?: number }) {
  const reduce = useReducedMotion();
  if (!values.length) return null;
  const dir = trendOf(values);
  const color = TREND_COLOR[dir];
  const R = 3; // endpoint radius; the others are smaller
  const pad = R + 1;
  const y = ys(values).map((t) => pad + t * (height - 2 * pad));
  const x = values.map((_, i) => (values.length === 1 ? width - pad : pad + (i * (width - 2 * pad)) / (values.length - 1)));
  const d = values.map((_, i) => `${i ? 'L' : 'M'}${x[i].toFixed(1)} ${y[i].toFixed(1)}`).join(' ');
  return (
    <svg
      data-testid="spark"
      data-trend={dir}
      data-points={values.length}
      role="img"
      aria-label={trendLabel(values)}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block shrink-0 overflow-visible"
    >
      <title>{trendLabel(values)}</title>
      {values.length > 1 && (
        <motion.path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay }}
        />
      )}
      {values.map((v, i) => {
        const last = i === values.length - 1;
        return (
          <circle
            key={i}
            data-testid="spark-point"
            data-value={Math.round(v * 100)}
            cx={x[i]}
            cy={y[i]}
            r={last ? R : 1.75}
            fill={color}
          />
        );
      })}
    </svg>
  );
}

/**
 * A small up/down line chart with a label under each point and the value above it (the Portfolio card's quarters).
 * Points sit at even steps across the width; the line is drawn in a stretched svg (non-scaling stroke) and the dots and
 * labels in HTML on top, so they stay round and crisp at any card size.
 */
export function TrendChart({ points, className = '' }: { points: { label: string; value: number }[]; className?: string }) {
  const reduce = useReducedMotion();
  if (!points.length) return null;
  const values = points.map((p) => p.value);
  const dir = trendOf(values);
  const color = TREND_COLOR[dir];
  const PADX = 18; // % inset, so the labels under the end points stay inside
  const TOP = 34; // plot band, in % of the height: values above it, quarter labels below
  const BOTTOM = 62;
  const x = points.map((_, i) => (points.length === 1 ? 50 : PADX + (i * (100 - 2 * PADX)) / (points.length - 1)));
  const y = ys(values).map((t) => TOP + t * (BOTTOM - TOP));
  return (
    <div
      data-testid="trend-chart"
      data-trend={dir}
      data-points={points.length}
      role="img"
      aria-label={points.map((p) => `${p.label} ${pct(p.value)}%`).join(' → ')}
      className={`relative ${className}`}
    >
      {points.length > 1 && (
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <motion.polyline
            data-testid="trend-line"
            points={points.map((_, i) => `${x[i]},${y[i]}`).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
          />
        </svg>
      )}
      {points.map((p, i) => {
        const last = i === points.length - 1;
        return (
          <div key={p.label} aria-hidden>
            <span
              data-testid="trend-value"
              className={`num absolute -translate-x-1/2 -translate-y-full whitespace-nowrap pb-[5px] text-[12px] leading-none ${last ? 'font-semibold text-ink' : 'text-muted'}`}
              style={{ left: `${x[i]}%`, top: `${y[i]}%` }}
            >
              {pct(p.value)}%
            </span>
            <span
              data-testid="trend-point"
              data-value={Math.round(p.value * 100)}
              className="absolute block -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${x[i]}%`, top: `${y[i]}%`, background: color, width: last ? 8 : 6, height: last ? 8 : 6 }}
            />
            <span
              data-testid="trend-label"
              className="num absolute bottom-0 -translate-x-1/2 whitespace-nowrap text-[11px] leading-none text-muted"
              style={{ left: `${x[i]}%` }}
            >
              {p.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
