'use client';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { CountUp } from '@/components/motion/CountUp';
import { bandFor } from '@/lib/scoring';
import { bandTone, pct } from '@/lib/format';
import { calm, STAGGER } from '@/lib/motion';
import { BentoCard, TileLabel } from './BentoGrid';
import { CardChevron, PAD, whole } from './parts';

export interface RegionRow {
  region: string;
  score: number | null;
  audits: number;
  contractors: number;
  /** Average per quarter, oldest first: the hover layer. */
  byQuarter: { label: string; score: number | null }[];
}

/**
 * S: sub-region 1 against sub-region 2: each region's average score as a big figure over a band-coloured bar, and its
 * audits and contractors. Hover: the same two regions quarter by quarter. Opens the audits log.
 */
export function RegionsCard({ rows, href }: { rows: RegionRow[]; href: string }) {
  const reduce = useReducedMotion();
  return (
    <BentoCard i={5} testid="kpi-regions" className={`${PAD} lift reveal-host group gap-2 min-[640px]:col-span-2`}>
      <Link href={href} aria-label="Sub-regions. Open the audits log" className="absolute inset-0 z-[1] rounded-[var(--radius-card)]" />
      <CardChevron small />
      <TileLabel>Sub-regions</TileLabel>
      <div className="swap min-h-0 flex-1">
        <div className="swap-a grid min-h-0 grid-cols-2 items-end gap-[clamp(10px,1.2vw,20px)]">
          {rows.map((r, k) => {
            const band = r.score === null ? null : bandFor(r.score);
            return (
              <div key={r.region} data-testid="region-col" className={`flex min-w-0 flex-col gap-1.5 ${band ? `tone-${bandTone(band)}` : ''}`}>
                <span className="text-[13px] font-semibold text-muted">{r.region}</span>
                <p className="figure text-[clamp(26px,4.4svh,48px)]">
                  {r.score === null ? <span className="text-faint">—</span> : <CountUp value={r.score * 100} format={whole} delay={0.4 + k * STAGGER} />}
                  {r.score !== null && <span className="ml-0.5 text-[0.45em] tracking-normal text-muted">%</span>}
                </p>
                <span className="block h-[clamp(6px,0.9svh,9px)] overflow-hidden rounded-full bg-fill-2" aria-hidden>
                  {r.score !== null && (
                    <motion.span
                      className="block h-full rounded-full"
                      style={{ width: `${r.score * 100}%`, background: 'var(--tone-dot)', transformOrigin: 'left' }}
                      initial={reduce ? false : { scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={calm(0.45 + k * STAGGER)}
                    />
                  )}
                </span>
                <span className="text-[12px] text-muted">
                  <span className="num font-semibold text-ink">{r.audits}</span> audits
                </span>
              </div>
            );
          })}
        </div>
        <ul data-testid="regions-by-quarter" aria-hidden className="swap-b flex min-h-0 flex-col justify-end gap-1.5">
          {rows.map((r) => (
            <li key={r.region} className="grid grid-cols-[2.6em_repeat(auto-fit,minmax(0,1fr))] items-baseline gap-2 text-[12.5px]">
              <span className="font-semibold">{r.region}</span>
              {r.byQuarter.map((q) => (
                <span key={q.label} className="flex items-baseline justify-end gap-1.5 whitespace-nowrap">
                  <span className="text-muted">{q.label}</span>
                  <span className="num font-semibold">{q.score === null ? '—' : `${pct(q.score)}%`}</span>
                </span>
              ))}
            </li>
          ))}
        </ul>
      </div>
    </BentoCard>
  );
}
