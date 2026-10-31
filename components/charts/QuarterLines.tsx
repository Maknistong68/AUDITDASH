'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { deltaPoints, pct } from '@/lib/format';
import { calm, DUR, QUICK, STAGGER } from '@/lib/motion';
import type { QuarterLine } from '@/lib/analytics';
import type { Quarter } from '@/lib/types';

const GUIDES = [0.8, 0.7, 0.6, 0.5];
const qLabel = (q: Quarter) => q.replace('-', ' ');

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

const dirOf = (v: (number | null)[]): 'up' | 'down' | 'flat' | 'single' => {
  const xs = v.filter((x): x is number => x !== null);
  if (xs.length < 2) return 'single';
  const d = deltaPoints(xs[xs.length - 1], xs[xs.length - 2])!;
  return d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
};
const COLOR = { up: 'var(--up)', down: 'var(--down)', flat: 'var(--muted)', single: 'var(--muted)' };

/** Distance from point p to segment ab, in px. */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Score by quarter: one thin line per contractor between the quarters (green when it rose, red when it fell, grey dot
 * when audited in one quarter only) and the portfolio average as the one bold line, labelled at both ends. Hovering
 * picks the nearest contractor line: it comes forward with its name and both scores, the rest step back.
 * Lines draw in over 1.5 s on the house curve.
 */
export function QuarterLines({ quarters, portfolio, lines, delay = 0.35 }: {
  quarters: Quarter[]; portfolio: (number | null)[]; lines: QuarterLine[]; delay?: number;
}) {
  const reduce = useReducedMotion();
  const [box, { w, h }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<string | null>(null);

  const geo = useMemo(() => {
    if (!quarters.length || w === 0 || h === 0) return null;
    const PAD = { l: 30, r: 30, t: 14, b: 26 };
    const vals = [...lines.flatMap((l) => l.values), ...portfolio].filter((v): v is number => v !== null);
    const lo = Math.min(0.5, Math.floor((Math.min(...vals) - 0.02) * 20) / 20);
    const hi = Math.max(0.8, Math.ceil((Math.max(...vals) + 0.02) * 20) / 20);
    const inner = w - PAD.l - PAD.r;
    // Quarters sit well inside the plot so the end labels have room.
    const x = (i: number) => (quarters.length === 1 ? PAD.l + inner / 2 : PAD.l + inner * (0.16 + (0.68 * i) / (quarters.length - 1)));
    const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (h - PAD.t - PAD.b);
    return { PAD, x, y, lo, hi };
  }, [quarters, portfolio, lines, w, h]);

  const pts = (v: (number | null)[]) => (geo ? v.flatMap((y, i) => (y === null ? [] : [{ x: geo.x(i), y: geo.y(y), v: y }])) : []);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!geo) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    let best: { id: string; d: number } | null = null;
    for (const l of lines) {
      const p = pts(l.values);
      const d = p.length === 1 ? Math.hypot(px - p[0].x, py - p[0].y) : p.slice(1).reduce((m, b, i) => Math.min(m, segDist(px, py, p[i].x, p[i].y, b.x, b.y)), Infinity);
      if (!best || d < best.d) best = { id: l.id, d };
    }
    setHover(best && best.d < 22 ? best.id : null);
  };

  const active = lines.find((l) => l.id === hover);
  const port = pts(portfolio);

  return (
    <div
      ref={box}
      data-testid="quarter-lines"
      role="img"
      aria-label={`Score by quarter. Portfolio ${portfolio.map((v, i) => `${qLabel(quarters[i])} ${pct(v)}%`).join(', ')}`}
      className="relative min-h-[160px] flex-1 touch-none select-none"
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
    >
      {geo && (
        <svg width={w} height={h} className="absolute inset-0 overflow-visible" aria-hidden>
          {GUIDES.filter((g) => g >= geo.lo && g <= geo.hi).map((g) => (
            <g key={g}>
              <line x1={geo.PAD.l} x2={w - geo.PAD.r} y1={geo.y(g)} y2={geo.y(g)} stroke="var(--hairline)" strokeDasharray="2 4" />
              <text x={geo.PAD.l - 8} y={geo.y(g)} dy="0.32em" textAnchor="end" className="num fill-[var(--faint)] text-[12px]">
                {Math.round(g * 100)}
              </text>
            </g>
          ))}
          {quarters.map((q, i) => (
            <g key={q}>
              <line x1={geo.x(i)} x2={geo.x(i)} y1={geo.PAD.t} y2={h - geo.PAD.b} stroke="var(--hairline)" />
              <text x={geo.x(i)} y={h - geo.PAD.b + 17} textAnchor="middle" className="fill-[var(--muted)] text-[12px] font-semibold">
                {qLabel(q)}
              </text>
            </g>
          ))}
          {lines.map((l, k) => {
            const p = pts(l.values);
            const dir = dirOf(l.values);
            const on = hover === l.id;
            const dim = hover !== null && !on;
            const t = calm(delay + k * (STAGGER / 2));
            return (
              <g key={l.id} data-testid="quarter-line" data-id={l.id} data-trend={dir} style={{ opacity: dim ? 0.12 : 1, transition: 'opacity 450ms var(--ease)' }}>
                {p.length > 1 && (
                  <motion.path
                    d={p.map((q, i) => `${i ? 'L' : 'M'}${q.x},${q.y}`).join('')}
                    fill="none"
                    stroke={COLOR[dir]}
                    strokeOpacity={on ? 1 : 0.55}
                    strokeWidth={on ? 2.5 : 1.5}
                    strokeLinecap="round"
                    initial={reduce ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={t}
                  />
                )}
                {p.map((q, i) => (
                  <motion.circle
                    key={i}
                    cx={q.x}
                    cy={q.y}
                    r={on ? 4.5 : 3}
                    fill={COLOR[dir]}
                    stroke="var(--surface)"
                    strokeWidth={1.5}
                    initial={reduce ? false : { opacity: 0 }}
                    animate={{ opacity: on ? 1 : 0.8 }}
                    transition={hover === null ? calm(delay + DUR * 0.5 * i + k * (STAGGER / 2), 0.8) : QUICK}
                  />
                ))}
              </g>
            );
          })}
          {/* The portfolio average: the one bold line, labelled at both ends. */}
          <g data-testid="quarter-portfolio" style={{ opacity: hover ? 0.3 : 1, transition: 'opacity 450ms var(--ease)' }}>
            {port.length > 1 && (
              <motion.path
                d={port.map((q, i) => `${i ? 'L' : 'M'}${q.x},${q.y}`).join('')}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={3.5}
                strokeLinecap="round"
                initial={reduce ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={calm(delay + 0.25)}
              />
            )}
            {port.map((q, i) => (
              <g key={i}>
                <circle cx={q.x} cy={q.y} r={6} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
                <motion.text
                  x={q.x + (i === 0 ? -12 : 12)}
                  y={q.y}
                  dy="0.35em"
                  textAnchor={i === 0 ? 'end' : 'start'}
                  className="num fill-[var(--text)] text-[15px] font-semibold"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={calm(delay + DUR * 0.6)}
                >
                  {pct(q.v)}%
                </motion.text>
              </g>
            ))}
          </g>
          {active && (
            <g data-testid="quarter-line-label">
              {pts(active.values).map((q, i, all) => (
                <text
                  key={i}
                  x={q.x + (all.length > 1 && i === 0 ? -10 : 10)}
                  y={q.y}
                  dy="0.35em"
                  textAnchor={all.length > 1 && i === 0 ? 'end' : 'start'}
                  className="num fill-[var(--text)] text-[13px] font-semibold"
                >
                  {pct(q.v)}%
                </text>
              ))}
            </g>
          )}
        </svg>
      )}
      {active && geo && (
        <motion.p
          key={active.id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={QUICK}
          className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap rounded-full bg-fill px-3 py-1 text-[12.5px] font-semibold"
        >
          {active.name}
        </motion.p>
      )}
    </div>
  );
}
