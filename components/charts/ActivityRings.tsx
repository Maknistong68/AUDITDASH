'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { useId } from 'react';
import { pct } from '@/lib/format';

export type RingKey = 'A' | 'B' | 'C';
export const RING_META: { key: RingKey; label: string; full: string; color: string; end: string }[] = [
  { key: 'A', label: 'Management', full: 'A · Management', color: 'var(--ring-a)', end: 'var(--ring-a-end)' },
  { key: 'B', label: 'Site processes', full: 'B · Site processes', color: 'var(--ring-b)', end: 'var(--ring-b-end)' },
  { key: 'C', label: 'Planning', full: 'C · Planning & commitment', color: 'var(--ring-c)', end: 'var(--ring-c-end)' },
];

/* Geometry in a 100×100 viewBox: three concentric rings, outer = A. */
const W = 10.5;
const GAP = 2.2;
const RADII = [50 - W / 2, 50 - W / 2 - (W + GAP), 50 - W / 2 - 2 * (W + GAP)];
const SEGMENTS = 64;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Arc path from angle a0 to a1 (radians, 0 = 12 o'clock, clockwise). */
function arc(r: number, a0: number, a1: number): string {
  const p = (a: number) => `${(50 + r * Math.sin(a)).toFixed(3)} ${(50 - r * Math.cos(a)).toFixed(3)}`;
  return `M ${p(a0)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)}`;
}

/**
 * The ring's colour runs along the arc (deep at the start, light at the tip), like Apple's activity rings.
 * SVG has no conic stroke, so the colour is painted as short segments under a mask; the mask is one round-capped
 * circle whose dash offset animates (spring). The masked circle is the `ring-arc`: its final offset is
 * circ × (1 − value), which reduced motion renders at once.
 */
function Ring({ i, value, delay, uid }: { i: number; value: number | null; delay: number; uid: string }) {
  const reduce = useReducedMotion();
  const meta = RING_META[i];
  const r = RADII[i];
  const circ = 2 * Math.PI * r;
  const ok = value !== null && Number.isFinite(value) && value > 0;
  const v = ok ? clamp01(value) : 0;
  const capAngle = (W / 2) / r;
  // Paint a little past the value so the spring's overshoot and the round tip stay coloured.
  const paintTo = Math.min(2 * Math.PI, (v + 0.06) * 2 * Math.PI + capAngle);
  const segs: { d: string; t: number }[] = [];
  if (ok) {
    const n = Math.max(6, Math.ceil((SEGMENTS * paintTo) / (2 * Math.PI)));
    for (let s = 0; s < n; s++) {
      const a0 = (paintTo * s) / n;
      const a1 = Math.min(paintTo, (paintTo * (s + 1)) / n + 0.012);
      segs.push({ d: arc(r, a0, a1), t: Math.min(1, a0 / Math.max(0.001, v * 2 * Math.PI)) });
    }
  }
  const maskId = `${uid}-m${i}`;
  return (
    <g>
      <circle cx="50" cy="50" r={r} fill="none" strokeWidth={W} style={{ stroke: meta.color, strokeOpacity: 'var(--ring-track)' }} />
      {ok && (
        <>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
            <motion.circle
              data-testid="ring-arc"
              data-value={v.toFixed(4)}
              data-circ={circ.toFixed(3)}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke="#fff"
              strokeWidth={W}
              strokeLinecap="round"
              strokeDasharray={`${circ} ${circ}`}
              transform="rotate(-90 50 50)"
              initial={reduce ? false : { strokeDashoffset: circ, opacity: 0 }}
              animate={{ strokeDashoffset: circ * (1 - v), opacity: 1 }}
              transition={
                reduce
                  ? { duration: 0 }
                  : {
                      strokeDashoffset: { type: 'spring', stiffness: 46, damping: 13, mass: 1, delay },
                      opacity: { duration: 0.15, delay },
                    }
              }
            />
          </mask>
          <g mask={`url(#${maskId})`}>
            {/* The start cap sits just before 12 o'clock: paint it in the start colour. */}
            <path d={arc(r, -capAngle - 0.02, 0.02)} fill="none" strokeWidth={W} style={{ stroke: meta.color }} />
            {segs.map((s, k) => (
              <path
                key={k}
                d={s.d}
                fill="none"
                strokeWidth={W}
                style={{ stroke: `color-mix(in oklab, ${meta.color} ${Math.round((1 - s.t) * 100)}%, ${meta.end})` }}
              />
            ))}
          </g>
        </>
      )}
    </g>
  );
}

/** Three concentric activity rings (outer A Management, middle B Site processes, inner C Planning). */
export function ActivityRings({
  rings,
  delay = 0,
  className,
  label,
}: {
  rings: Record<RingKey, number | null>;
  delay?: number;
  className?: string;
  label?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const aria =
    label ?? RING_META.map((m) => `${m.label} ${rings[m.key] === null ? 'not scored' : `${pct(rings[m.key])}%`}`).join(', ');
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={aria}>
      {RING_META.map((m, i) => (
        <Ring key={m.key} i={i} value={rings[m.key]} delay={delay + i * 0.09} uid={uid} />
      ))}
    </svg>
  );
}

/** One ring (portfolio score): same drawing as a single-ring set, coloured by a tone. */
export function SingleRing({
  value,
  color,
  end,
  delay = 0,
  className,
  label,
}: {
  value: number | null;
  color: string;
  end: string;
  delay?: number;
  className?: string;
  label: string;
}) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, '');
  const w = 14;
  const r = 50 - w / 2;
  const circ = 2 * Math.PI * r;
  const ok = value !== null && Number.isFinite(value) && value > 0;
  const v = ok ? clamp01(value) : 0;
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={label}>
      <defs>
        <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: end }} />
          <stop offset="1" style={{ stopColor: color }} />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r={r} fill="none" strokeWidth={w} style={{ stroke: color, strokeOpacity: 'var(--ring-track)' }} />
      {ok && (
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={`url(#${uid}-g)`}
          strokeWidth={w}
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          transform="rotate(-90 50 50)"
          initial={reduce ? false : { strokeDashoffset: circ, opacity: 0 }}
          animate={{ strokeDashoffset: circ * (1 - v), opacity: 1 }}
          transition={
            reduce
              ? { duration: 0 }
              : { strokeDashoffset: { type: 'spring', stiffness: 40, damping: 13, delay }, opacity: { duration: 0.15, delay } }
          }
        />
      )}
    </svg>
  );
}
