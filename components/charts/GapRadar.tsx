'use client';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { categoryById } from '@/lib/categories';
import { pct } from '@/lib/format';
import type { CategoryId } from '@/lib/types';
import { Signed } from '@/components/bento/parts';
import { GapBar } from '@/components/details/parts';
import { CATEGORY_ICONS } from './categoryIcons';

export interface GapRow { category: CategoryId; gapRate: number | null; prevGapRate: number | null; findings: number }

const MotionLink = motion.create(Link);
const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * "Where it fails": the ten categories as bento tiles, worst score-based gap first (gap = share of the
 * category's weighted score lost; 0 = none). Severity is drawn only in the single `--gap` hue. Each tile shows
 * the gap %, the findings count and, when there is a previous quarter in the filter, the Δ in whole points
 * (a rising gap is bad, so it reads red). Tiles stagger in when the grid scrolls into view.
 */
export function GapRadar({ gaps, query }: { gaps: GapRow[]; query: string }) {
  const reduce = useReducedMotion();
  const ranked = [...gaps].sort((a, b) => (b.gapRate ?? -1) - (a.gapRate ?? -1));
  return (
    <motion.ol
      className="grid grid-cols-2 gap-[var(--gap-grid)] min-[760px]:grid-cols-3 min-[1000px]:grid-cols-5"
      initial={reduce ? false : 'hidden'}
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      variants={{ show: { transition: { staggerChildren: 0.045 } } }}
    >
      {ranked.map((g, i) => {
        const cat = categoryById(g.category);
        const Icon = CATEGORY_ICONS[cat.icon];
        const ok = g.gapRate !== null && Number.isFinite(g.gapRate);
        const d = ok && g.prevGapRate !== null ? Math.round(g.gapRate! * 100) - Math.round(g.prevGapRate * 100) : null;
        return (
          <motion.li
            key={g.category}
            className="flex min-w-0"
            variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } } }}
          >
            <MotionLink
              layoutId={`cat-${g.category}`}
              href={`/category/${g.category}?${query}`}
              data-testid="gap-tile"
              data-gap={ok ? g.gapRate! : -1}
              aria-label={`${i + 1}. ${cat.name}: ${ok ? `${pct(g.gapRate)}% gap` : 'not applicable'}, ${g.findings} findings`}
              className="card lift group flex w-full min-w-0 flex-col gap-[clamp(12px,1.8svh,20px)] p-[clamp(16px,1.3vw,24px)] transition-[translate,box-shadow] duration-300 hover:-translate-y-1"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]">
                  {Icon && <Icon size={17} strokeWidth={2} className="shrink-0 text-muted transition-colors group-hover:text-ink" aria-hidden />}
                  <span className="truncate">{cat.short}</span>
                </span>
                <span className="num text-[13px] font-semibold text-faint">{i + 1}</span>
              </span>
              <span className="flex items-baseline gap-2">
                <span className="figure text-[clamp(38px,4.8svh,56px)]">
                  {ok ? pct(g.gapRate) : <span className="text-faint">—</span>}
                  {ok && <span className="text-[0.42em] tracking-normal text-muted">%</span>}
                </span>
                <span className="text-[13px] text-muted">{ok ? 'gap' : 'N/A'}</span>
              </span>
              <GapBar value={ok ? g.gapRate : null} />
              <span className="flex items-center justify-between gap-2 text-[13px] text-muted">
                <span className="num">
                  <span className="font-semibold text-ink">{g.findings}</span> {g.findings === 1 ? 'finding' : 'findings'}
                </span>
                {d !== null && (
                  <span className="inline-flex items-center gap-1" title={`Gap ${pct(g.gapRate)}% vs ${pct(g.prevGapRate)}% in Q4 2025`}>
                    <Signed d={d} invert unit={false} />
                    <span>vs Q4</span>
                  </span>
                )}
              </span>
            </MotionLink>
          </motion.li>
        );
      })}
    </motion.ol>
  );
}
