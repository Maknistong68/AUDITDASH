'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { BANDS, bandFor } from '@/lib/scoring';
import { bandColor, bandShort, pct } from '@/lib/format';
import type { Band } from '@/lib/types';
import { TREND_COLOR, trendOf } from './Trend';
import { EASE, DUR } from '@/lib/motion';

export interface ScoreTrendPoint { auditId: string; date: string; label: string; score: number }

/** Lower bound of each band (BANDS order), as fractions. */
const FLOOR: Record<Band, number> = { Excellent: 0.9, Good: 0.8, 'Partially Compliant': 0.7, 'Minimally Compliant': 0.6, 'Non-Compliant': 0 };

/**
 * Y domain: whole 10-point steps around the scores, never narrower than 60–90%, so a band zone is always a real band and
 * a few points' change is not blown up.
 */
function domain(values: number[]): [number, number] {
  const lo = Math.max(0, Math.min(0.6, Math.floor((Math.min(...values) - 0.02) * 10) / 10));
  const hi = Math.min(1, Math.max(0.9, Math.ceil((Math.max(...values) + 0.02) * 10) / 10));
  return [lo, hi];
}

/**
 * A contractor's audit scores in date order, one band-coloured point per audit labelled with its score and date, over the
 * band zones (subtle tints, named at the right). The line is green when the latest score rose over the one before, red
 * when it fell (grey: no change). One audit: a single point, "First audit". The active point is the carousel's current
 * slide; clicking a point opens that audit. Geometry: zones and line in a stretched svg (non-scaling stroke); points and
 * labels in HTML on top, so they stay round and crisp at any size.
 */
export function ScoreTrend({ points, active, onSelect }: { points: ScoreTrendPoint[]; active: number; onSelect: (i: number) => void }) {
  const reduce = useReducedMotion();
  if (!points.length) return null;
  const values = points.map((p) => p.score);
  const dir = trendOf(values);
  const [lo, hi] = domain(values);
  const y = (v: number) => ((hi - Math.min(hi, Math.max(lo, v))) / (hi - lo)) * 100;
  const n = points.length;
  // Even steps in date order; one audit sits in the middle.
  const x = (i: number) => (n === 1 ? 50 : 6 + (i * 88) / (n - 1));
  const zones = BANDS.map((b, i) => {
    const top = i === 0 ? 1 : FLOOR[BANDS[i - 1]];
    const a = Math.max(lo, FLOOR[b]);
    const z = Math.min(hi, top);
    return { band: b, from: a, to: z };
  }).filter((zn) => zn.to > zn.from);

  return (
    <div
      data-testid="score-trend"
      data-trend={dir}
      data-points={n}
      role="group"
      aria-label={`Score by audit: ${points.map((p) => `${p.label} ${pct(p.score)}%`).join(' → ')}`}
      className="card relative h-full min-h-0 w-full overflow-hidden"
    >
      {/* Plot: band zones run under the right-hand gutter that names them; dates sit under the plot. */}
      <div className="absolute inset-x-0 bottom-[clamp(24px,3.2svh,32px)] top-0">
        {zones.map((zn) => (
          <div
            key={zn.band}
            data-testid="band-zone"
            data-band={zn.band}
            aria-hidden
            className="absolute inset-x-0"
            style={{
              top: `${y(zn.to)}%`,
              height: `${y(zn.from) - y(zn.to)}%`,
              background: `color-mix(in srgb, ${bandColor(zn.band)} 9%, transparent)`,
            }}
          >
            <span className="absolute right-[clamp(10px,1vw,16px)] top-1/2 -translate-y-1/2 whitespace-nowrap text-[12px] font-semibold leading-none" style={{ color: 'var(--faint)' }}>
              {bandShort(zn.band)}
            </span>
          </div>
        ))}

        <div className="absolute inset-y-0 left-[clamp(12px,1.4vw,24px)] right-[clamp(96px,8vw,124px)]">
          {n > 1 && (
            <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              <motion.polyline
                data-testid="score-trend-line"
                points={points.map((p, i) => `${x(i)},${y(p.score)}`).join(' ')}
                fill="none"
                stroke={TREND_COLOR[dir]}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: DUR, ease: EASE, delay: 0.3 }}
              />
            </svg>
          )}
          {points.map((p, i) => {
            const band = bandFor(p.score);
            const on = i === active;
            const name = `${p.label}: ${pct(p.score)}%, ${bandShort(band)}`;
            // The value sits above its point, or below it near the top so it never leaves the chart.
            const below = y(p.score) < 34;
            return (
              <div key={p.auditId}>
                <span
                  aria-hidden
                  data-testid="score-trend-value"
                  className={`num absolute -translate-x-1/2 whitespace-nowrap leading-none transition-colors ${below ? 'pt-[13px]' : '-translate-y-full pb-[13px]'} ${on ? 'text-[clamp(15px,2svh,19px)] font-semibold text-ink' : 'text-[clamp(13px,1.6svh,15px)] text-muted'}`}
                  style={{ left: `${x(i)}%`, top: `${y(p.score)}%` }}
                >
                  {pct(p.score)}%
                </span>
                <button
                  type="button"
                  data-testid="score-trend-point"
                  data-band={band}
                  data-value={Math.round(p.score * 100)}
                  data-active={on ? '' : undefined}
                  aria-label={`${name}. Show this audit`}
                  aria-current={on ? 'true' : undefined}
                  title={name}
                  onClick={() => onSelect(i)}
                  className="absolute grid size-8 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full transition-colors hover:bg-fill focus-visible:bg-fill"
                  style={{ left: `${x(i)}%`, top: `${y(p.score)}%` }}
                >
                  <motion.span
                    data-testid="score-trend-dot"
                    className="block rounded-full transition-[width,height,box-shadow] duration-300"
                    style={{
                      background: bandColor(band),
                      width: on ? 16 : 11,
                      height: on ? 16 : 11,
                      boxShadow: on ? '0 0 0 3px var(--surface), 0 0 0 5px var(--text)' : '0 0 0 2px var(--surface)',
                    }}
                    initial={reduce ? false : { scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'tween', ease: EASE, duration: DUR, delay: 0.15 + i * 0.08 }}
                  />
                </button>
                {n === 1 && (
                  <span
                    data-testid="score-trend-first"
                    className="absolute -translate-y-1/2 whitespace-nowrap pl-5 text-[13px] text-muted"
                    style={{ left: `${x(i)}%`, top: `${y(p.score)}%` }}
                  >
                    First audit
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[clamp(24px,3.2svh,32px)]">
        <div className="absolute inset-y-0 left-[clamp(12px,1.4vw,24px)] right-[clamp(96px,8vw,124px)]">
          {points.map((p, i) => (
            <span
              key={p.auditId}
              data-testid="score-trend-date"
              className={`num absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[12px] leading-none ${i === active ? 'font-semibold text-ink' : 'text-muted'}`}
              // Centred under its point; the end labels lean inwards so a narrow chart never cuts them.
              style={{ left: `${x(i)}%`, translate: n > 1 && i === 0 ? '-16px 0' : n > 1 && i === n - 1 ? 'calc(-100% + 16px) 0' : '-50% 0' }}
            >
              {p.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
