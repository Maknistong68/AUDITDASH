'use client';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { bandFor } from '@/lib/scoring';
import { bandShort, bandTone, pct } from '@/lib/format';
import { calm, DUR, EASE, QUICK } from '@/lib/motion';
import type { MonthPoint } from '@/lib/analytics';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BANDS = [
  { at: 0.8, label: 'Good' },
  { at: 0.7, label: 'Partial' },
  { at: 0.6, label: 'Minimal' },
];
const monthIndex = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
const monthName = (i: number) => MONTHS[((i % 12) + 12) % 12];
const yearOf = (i: number) => Math.floor(i / 12);

/** Pixel size of an element, kept current. */
function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/**
 * The portfolio score over time: one point per month with audits (average honest score), on a real month axis so a
 * quiet stretch shows as a dashed bridge. Band thresholds are faint guides. Single series: the title names it, no
 * legend. Hover anywhere on the plot: a crosshair snaps to the nearest month and a card lists that month's audits.
 * The line draws in over 1.5 s on the house curve; dots arrive as the line reaches them.
 */
export function ScoreLine({ points, delay = 0.35 }: { points: MonthPoint[]; delay?: number }) {
  const reduce = useReducedMotion();
  const [box, { w, h }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const geo = useMemo(() => {
    if (!points.length || w === 0 || h === 0) return null;
    const PAD = { l: 34, r: 16, t: 18, b: 30 };
    const first = monthIndex(points[0].month);
    const last = monthIndex(points.at(-1)!.month);
    const span = Math.max(1, last - first);
    const vals = points.map((p) => p.avg);
    const lo = Math.min(0.5, Math.floor((Math.min(...vals) - 0.04) * 20) / 20);
    const hi = Math.max(0.8, Math.ceil((Math.max(...vals) + 0.06) * 20) / 20);
    const x = (m: number) => PAD.l + ((m - first) / span) * (w - PAD.l - PAD.r);
    const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (h - PAD.t - PAD.b);
    const xy = points.map((p) => ({ x: x(monthIndex(p.month)), y: y(p.avg) }));
    // Solid between neighbouring months, dashed across months without audits.
    const solid: string[] = [];
    const dashed: string[] = [];
    xy.forEach((p, i) => {
      if (!i) return;
      const seg = `M${xy[i - 1].x},${xy[i - 1].y}L${p.x},${p.y}`;
      (monthIndex(points[i].month) - monthIndex(points[i - 1].month) > 1 ? dashed : solid).push(seg);
    });
    const line = xy.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join('');
    const area = `${line}L${xy.at(-1)!.x},${h - PAD.b}L${xy[0].x},${h - PAD.b}Z`;
    const ticks = Array.from({ length: span + 1 }, (_, k) => first + k);
    return { PAD, x, y, xy, solid, dashed, line, area, ticks, lo, hi };
  }, [points, w, h]);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!geo) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    let best = 0;
    geo.xy.forEach((p, i) => { if (Math.abs(p.x - px) < Math.abs(geo.xy[best].x - px)) best = i; });
    setHover(best);
  };

  const active = hover === null ? null : points[hover];
  const at = hover === null || !geo ? null : geo.xy[hover];
  const totalAudits = points.reduce((s, p) => s + p.audits.length, 0);

  return (
    <div
      ref={box}
      data-testid="score-line"
      role="img"
      aria-label={`Average audit score by month: ${points.map((p) => `${monthName(monthIndex(p.month))} ${p.month.slice(0, 4)} ${pct(p.avg)}%`).join(', ')}`}
      className="relative min-h-[180px] flex-1 touch-none select-none"
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
    >
      {geo && (
        <svg width={w} height={h} className="absolute inset-0 overflow-visible" aria-hidden>
          <defs>
            <linearGradient id="score-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Band thresholds: recessive guides, labelled at the left edge. */}
          {BANDS.filter((b) => b.at > geo.lo && b.at <= geo.hi).map((b) => (
            <g key={b.at}>
              <line x1={geo.PAD.l} x2={w - geo.PAD.r} y1={geo.y(b.at)} y2={geo.y(b.at)} stroke="var(--hairline)" strokeWidth={1} strokeDasharray="2 4" />
              <text x={geo.PAD.l - 8} y={geo.y(b.at)} dy="0.32em" textAnchor="end" className="num fill-[var(--faint)] text-[10.5px]">
                {Math.round(b.at * 100)}
              </text>
            </g>
          ))}
          {/* Month axis: every month, year under January and the first month. */}
          {geo.ticks.map((m, k) => (
            <g key={m}>
              <text x={geo.x(m)} y={h - geo.PAD.b + 16} textAnchor="middle" className="fill-[var(--faint)] text-[10.5px]">
                {monthName(m)}
              </text>
              {(k === 0 || m % 12 === 0) && (
                <text x={geo.x(m)} y={h - geo.PAD.b + 28} textAnchor="middle" className="num fill-[var(--faint)] text-[10px]">
                  {yearOf(m)}
                </text>
              )}
            </g>
          ))}
          <motion.path
            d={geo.area}
            fill="url(#score-area)"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={calm(delay + DUR * 0.45)}
          />
          {geo.solid.length > 0 && (
            <motion.path
              d={geo.solid.join('')}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={calm(delay)}
            />
          )}
          {geo.dashed.length > 0 && (
            <motion.path
              d={geo.dashed.join('')}
              fill="none"
              stroke="var(--accent)"
              strokeOpacity={0.55}
              strokeWidth={1.75}
              strokeDasharray="3 5"
              strokeLinecap="round"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={calm(delay + DUR * 0.5)}
            />
          )}
          {at && (
            <motion.line
              x1={at.x}
              x2={at.x}
              y1={geo.PAD.t - 6}
              y2={h - geo.PAD.b}
              stroke="var(--muted)"
              strokeOpacity={0.45}
              strokeWidth={1}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, x1: at.x, x2: at.x }}
              transition={QUICK}
            />
          )}
          {geo.xy.map((p, i) => {
            const last = i === geo.xy.length - 1;
            const on = hover === i;
            return (
              <motion.circle
                key={points[i].month}
                data-testid="score-line-point"
                data-value={Math.round(points[i].avg * 100)}
                cx={p.x}
                cy={p.y}
                r={on ? 6 : last ? 5 : 4}
                fill={last || on ? 'var(--accent)' : 'var(--surface)'}
                stroke="var(--accent)"
                strokeWidth={2}
                initial={reduce ? false : { opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ transformOrigin: `${p.x}px ${p.y}px` }}
                transition={calm(delay + (DUR * 0.7 * i) / Math.max(1, geo.xy.length - 1), 0.6)}
              />
            );
          })}
          {/* Direct labels: the first and the latest value only. */}
          {[0, geo.xy.length - 1].filter((i, k, a) => a.indexOf(i) === k).map((i) => (
            <motion.text
              key={`v${i}`}
              x={geo.xy[i].x}
              y={geo.xy[i].y - 12}
              textAnchor={i === 0 && geo.xy.length > 1 ? 'start' : 'end'}
              className={`num text-[12px] ${i === geo.xy.length - 1 ? 'fill-[var(--text)] font-semibold' : 'fill-[var(--muted)]'}`}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: hover === null ? 1 : 0.25 }}
              transition={hover === null ? calm(delay + DUR * 0.8, 0.8) : QUICK}
            >
              {pct(points[i].avg)}%
            </motion.text>
          ))}
        </svg>
      )}
      <AnimatePresence>
        {active && at && geo && (
          <motion.div
            key="tip"
            data-testid="score-line-tip"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0, left: Math.min(Math.max(at.x, 110), w - 110) }}
            exit={{ opacity: 0, y: 6, transition: { duration: 0.2 } }}
            transition={{ ...QUICK, left: { type: 'tween', ease: EASE, duration: 0.35 } }}
            className="glass pointer-events-none absolute top-0 z-10 w-[220px] -translate-x-1/2 rounded-[14px] px-3 py-2.5 text-[12px] shadow-[var(--shadow-lift)]"
            style={{ left: at.x }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold text-ink">
                {monthName(monthIndex(active.month))} {active.month.slice(0, 4)}
              </span>
              <span className="num text-[18px] font-semibold leading-none tracking-[-0.02em] text-ink">{pct(active.avg)}%</span>
            </div>
            <p className="mb-1.5 text-muted">
              {active.audits.length} {active.audits.length === 1 ? 'audit' : 'audits'} · {bandShort(bandFor(active.avg))}
            </p>
            <ul className="flex flex-col gap-1">
              {active.audits.slice(0, 5).map((a) => (
                <li key={a.auditId} className={`tone-${bandTone(bandFor(a.score))} grid grid-cols-[minmax(0,1fr)_44px_28px] items-center gap-2`}>
                  <span className="truncate">{a.contractor}</span>
                  <span className="h-[5px] rounded-full bg-fill-2">
                    <span className="block h-full rounded-full" style={{ width: `${a.score * 100}%`, background: 'var(--tone-dot)' }} />
                  </span>
                  <span className="num text-right font-semibold text-ink">{pct(a.score)}</span>
                </li>
              ))}
              {active.audits.length > 5 && <li className="text-faint">+{active.audits.length - 5} more</li>}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
      <span className="sr-only">{totalAudits} audits</span>
    </div>
  );
}
