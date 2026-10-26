'use client';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { bandFor } from '@/lib/scoring';
import { pct, pts } from '@/lib/format';
import type { Contractor } from '@/lib/types';

export interface RaceRow { contractor: Contractor; latest: number; previous: number | null }

const EASE = [0.16, 1, 0.3, 1] as const;
const ZONES: { from: number; to: number; label: string }[] = [
  { from: 0, to: 0.6, label: 'Non-compliant' },
  { from: 0.6, to: 0.7, label: 'Minimal' },
  { from: 0.7, to: 0.8, label: 'Partial' },
  { from: 0.8, to: 0.9, label: 'Good' },
  { from: 0.9, to: 1, label: 'Excellent' },
];
const DOT = 12; // visual dot size
const TIP_SHADOW = 'shadow-[0_6px_20px_rgba(0,0,0,0.18)]'; // taste-skill-ignore: the tooltip floats, so it may cast a shadow
const LABEL_ROW = 18;
const charW = 6.4; // ~12px Geist average advance

interface Placed {
  row: RaceRow; x: number; px: number | null; lane: number;
  label: { side: -1 | 1; level: number } | null; change: number | null;
}
interface Layout { placed: Placed[]; sp: number; top: number; bottom: number; levels: number }

/** Score domain: at least 55–90%, widened to whole 5s when data falls outside. */
function domainOf(rows: RaceRow[]): [number, number] {
  const vals = rows.flatMap((r) => [r.latest, ...(r.previous === null ? [] : [r.previous])]);
  const lo = Math.min(0.55, Math.floor((Math.min(...vals) - 0.01) * 20) / 20);
  const hi = Math.max(0.9, Math.ceil((Math.max(...vals) + 0.01) * 20) / 20);
  return [Math.max(0, lo), Math.min(1, hi)];
}

const laneOrder = (k: number) => (k === 0 ? 0 : (k % 2 ? -1 : 1) * Math.ceil(k / 2));

function layout(rows: RaceRow[], w: number, h: number, lo: number, hi: number): Layout {
  const X = (v: number) => ((v - lo) / (hi - lo)) * w;
  const levels = h >= 190 ? 2 : 1;
  const sp = h >= 190 ? 16 : 14;
  const laneCount = Math.max(1, Math.floor((h - 2 * levels * LABEL_ROW - 12) / sp));
  const maxK = laneCount - 1;
  // Each contractor occupies its whole trail [previous..latest]; it takes the nearest free lane
  // (0, -1, +1, -2 …) so trails never run on top of each other. If none is free, the least crowded lane.
  const lanes = new Map<number, [number, number][]>();
  const order = [...rows].sort((a, b) => b.latest - a.latest);
  const placed: Placed[] = order.map((row) => {
    const x = X(row.latest);
    const px = row.previous === null ? null : X(row.previous);
    const iv: [number, number] = [Math.min(x, px ?? x) - DOT / 2 - 4, Math.max(x, px ?? x) + DOT / 2 + 4];
    const hits = (lane: number) => (lanes.get(lane) ?? []).filter(([a, b]) => iv[0] < b && iv[1] > a).length;
    let lane = laneOrder(0);
    let best = Infinity;
    for (let k = 0; k <= maxK; k++) {
      const n = hits(laneOrder(k));
      if (n === 0) { lane = laneOrder(k); best = 0; break; }
      if (n < best) { best = n; lane = laneOrder(k); }
    }
    lanes.set(lane, [...(lanes.get(lane) ?? []), iv]);
    const change = row.previous === null ? null : row.latest - row.previous;
    return { row, x, px, lane, label: null, change };
  });
  const top = Math.min(...placed.map((p) => p.lane));
  const bottom = Math.max(...placed.map((p) => p.lane));
  // Labels: priority best, worst, then biggest movers; greedy into rows above/below without overlap.
  const prio = [...placed].sort((a, b) => {
    const rank = (p: Placed) => (p === placed[0] ? 0 : p === placed[placed.length - 1] ? 1 : 2);
    return rank(a) - rank(b) || Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0) || b.row.latest - a.row.latest;
  });
  const taken = new Map<string, [number, number][]>();
  for (const p of prio) {
    const half = (p.row.contractor.name.length * charW) / 2 + 6;
    const span: [number, number] = [p.x - half, p.x + half];
    if (span[0] < 0) { span[1] -= span[0]; span[0] = 0; }
    if (span[1] > w) { span[0] -= span[1] - w; span[1] = w; }
    const prefer: (-1 | 1)[] = p.lane > 0 ? [1, -1] : [-1, 1];
    outer: for (let level = 0; level < levels; level++) {
      for (const side of prefer) {
        const key = `${side}:${level}`;
        const used = taken.get(key) ?? [];
        if (used.some(([a, b]) => span[0] < b + 10 && span[1] > a - 10)) continue;
        taken.set(key, [...used, span]);
        p.label = { side, level };
        break outer;
      }
    }
  }
  return { placed, sp, top, bottom, levels };
}

/**
 * Contractor race: one score axis with faint band zones; a dot per contractor at its latest audit score.
 * On entry each dot travels from its previous (Q4) score to its latest, drawing a trail (green = improved,
 * accent = declined); contractors with no previous audit simply appear. Labels are placed without collisions;
 * unlabelled dots show their name on hover/focus. Every dot links to the contractor profile.
 */
export function ContractorRace({ rows, delay = 0.55 }: { rows: RaceRow[]; delay?: number }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [lo, hi] = useMemo(() => domainOf(rows), [rows]);
  const L = useMemo(() => (box.w ? layout(rows, box.w, box.h, lo, hi) : null), [rows, box.w, box.h, lo, hi]);
  const placed = L?.placed ?? [];
  const sp = L?.sp ?? 14;
  const pctX = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  // centre the lane block (plus its label rows) vertically
  const mid = L ? box.h / 2 - ((L.top + L.bottom) / 2) * sp : box.h / 2;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1" ref={ref}>
        {/* band zones */}
        {ZONES.filter((z) => z.to > lo && z.from < hi).map((z, i) => (
          <div
            key={z.label}
            className="absolute inset-y-0"
            style={{ left: pctX(Math.max(z.from, lo)), width: `calc(${pctX(Math.min(z.to, hi))} - ${pctX(Math.max(z.from, lo))})`, background: i % 2 ? 'var(--zone)' : 'transparent' }}
            aria-hidden
          >
          </div>
        ))}
        {/* axis line */}
        <span className="absolute inset-x-0 h-px bg-rule" style={{ top: mid }} aria-hidden />
        <ol aria-label="Contractors by latest audit score">
          {placed.map((p, i) => {
            const y = mid + p.lane * sp;
            const improved = (p.change ?? 0) > 0;
            const dx = p.px === null ? 0 : p.px - p.x;
            const t0 = reduce ? 0 : delay + i * 0.03;
            const name = p.row.contractor.name;
            const edge = p.label?.side === -1 ? mid + L!.top * sp - DOT / 2 - 4 : mid + L!.bottom * sp + DOT / 2 + 4;
            const labelY = p.label ? edge + p.label.side * (LABEL_ROW / 2 + p.label.level * LABEL_ROW) : 0;
            return (
              <li key={p.row.contractor.id}>
                {p.px !== null && Math.abs(dx) > 1 && (
                  <motion.span
                    aria-hidden
                    className="absolute h-[2px] rounded-full"
                    style={{
                      top: y - 1,
                      left: Math.min(p.x, p.px),
                      width: Math.abs(dx),
                      background: improved ? 'var(--positive)' : 'var(--gap-hue)',
                      opacity: 0.55,
                      transformOrigin: dx < 0 ? 'left' : 'right',
                    }}
                    initial={reduce ? false : { scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: reduce ? 0 : 0.9, delay: t0, ease: EASE }}
                  />
                )}
                {p.px !== null && Math.abs(dx) > 1 && (
                  <span aria-hidden className="absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-faint" style={{ left: p.px, top: y }} />
                )}
                {p.label && (
                  <span
                    aria-hidden
                    className="absolute w-px bg-control"
                    style={
                      p.label.side === -1
                        ? { left: p.x, top: labelY + LABEL_ROW / 2 - 2, height: Math.max(0, y - DOT / 2 - 2 - (labelY + LABEL_ROW / 2 - 2)) }
                        : { left: p.x, top: y + DOT / 2 + 2, height: Math.max(0, labelY - LABEL_ROW / 2 + 2 - (y + DOT / 2 + 2)) }
                    }
                  />
                )}
                {p.label && (
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[12px] leading-4 text-muted"
                    style={{ left: Math.min(Math.max(p.x, (name.length * charW) / 2 + 6), box.w - (name.length * charW) / 2 - 6), top: labelY }}
                    initial={reduce ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: reduce ? 0 : 0.4, delay: reduce ? 0 : t0 + 0.7 }}
                  >
                    {name}
                  </motion.span>
                )}
                <motion.div
                  className="group absolute -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-500 ease-out motion-reduce:transition-none"
                  style={{ left: p.x, top: y }}
                  initial={reduce ? false : p.px === null ? { opacity: 0, scale: 0.4 } : { x: dx }}
                  animate={{ x: 0, opacity: 1, scale: 1 }}
                  transition={{ duration: reduce ? 0 : 0.9, delay: t0, ease: EASE }}
                >
                  <Link
                    href={`/contractor/${p.row.contractor.id}`}
                    data-testid="league-row"
                    aria-label={`${name}: ${pct(p.row.latest)}%, ${bandFor(p.row.latest)}${p.change !== null ? `, ${pts(p.change)} points vs previous audit` : ''}`}
                    className="grid size-7 place-items-center rounded-full"
                  >
                    <span className="size-3 rounded-full bg-ink ring-2 ring-ground transition-transform duration-200 group-hover:scale-150 group-focus-within:scale-150 motion-reduce:transition-none" />
                  </Link>
                  <span
                    role="presentation"
                    className={`pointer-events-none invisible absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-control)] bg-ink px-2.5 py-1.5 text-[12px] leading-4 text-ground opacity-0 transition-opacity ${TIP_SHADOW} group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100`}
                  >
                    <span className="font-medium">{name}</span>
                    <span className="num ml-2 font-semibold">{pct(p.row.latest)}%</span>
                    {p.change !== null && Math.round(p.change * 100) !== 0 && (
                      <span className="num ml-2 opacity-75">{pts(p.change)} vs Q4</span>
                    )}
                  </span>
                </motion.div>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="num relative h-4 text-[11px] leading-4 text-faint" aria-hidden>
        {[0.6, 0.7, 0.8, 0.9].filter((e) => e > lo && e < hi).map((e) => (
          <span key={e} className="absolute -translate-x-1/2" style={{ left: pctX(e) }}>{Math.round(e * 100)}%</span>
        ))}
        {ZONES.filter((z) => z.to > lo && z.from < hi).map((z) => {
          const a = Math.max(z.from, lo);
          const b = Math.min(z.to, hi);
          return (
            <span key={z.label} className="kicker absolute -translate-x-1/2 whitespace-nowrap text-faint max-sm:hidden" style={{ left: pctX((a + b) / 2) }}>
              {z.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
