'use client';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { CSSProperties } from 'react';
import { CATEGORY_COLORS_DARK, categoryById } from '@/lib/categories';
import { pct, pts } from '@/lib/format';
import type { CategoryId } from '@/lib/types';
import { CATEGORY_ICONS } from './categoryIcons';
import { CountUp } from '@/components/motion/CountUp';

export interface GapRow { category: CategoryId; gapRate: number | null; prevGapRate: number | null }

const MotionLink = motion.create(Link);
const fmt = (n: number) => String(Math.round(n));
const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Gap radar: ten tiles ranked worst first. Each tile's fill runs from the left to its gap rate
 * (score-based: 0 = no gap, 1 = total gap) in the category's hue; the fill gets denser as the gap grows.
 * The worst three pulse. Each tile links to its category drill-down and morphs via layoutId.
 */
export function GapRadar({ gaps, query, onSelect }: { gaps: GapRow[]; query: string; onSelect?: (c: CategoryId) => void }) {
  const reduce = useReducedMotion();
  const ranked = [...gaps].sort((a, b) => (b.gapRate ?? -1) - (a.gapRate ?? -1));
  const worst = new Set(ranked.filter((g) => g.gapRate !== null).slice(0, 3).map((g) => g.category));
  const rates = ranked.map((g) => g.gapRate).filter((x): x is number => x !== null);
  const lo = Math.min(...rates);
  const hi = Math.max(...rates);

  return (
    <ol className="grid min-h-0 flex-1 auto-rows-[112px] grid-cols-2 gap-2.5 min-[1200px]:[grid-template-rows:repeat(5,minmax(0,1fr))]">
      {ranked.map((g, i) => {
        const cat = categoryById(g.category);
        const Icon = CATEGORY_ICONS[cat.icon];
        const ok = g.gapRate !== null;
        const rate = ok ? g.gapRate! : 0;
        // intensity: 18% tint for the mildest gap, 46% for the worst (by rank within the current view)
        const t = ok && hi > lo ? (rate - lo) / (hi - lo) : 0.5;
        const tint = Math.round(18 + 28 * t);
        const change = ok && g.prevGapRate !== null ? rate - g.prevGapRate : null;
        const hot = worst.has(g.category);
        const style = { '--cat-l': cat.color, '--cat-d': CATEGORY_COLORS_DARK[g.category] } as CSSProperties;
        return (
          <li key={g.category} className="min-h-0">
            <MotionLink
              layoutId={`cat-${g.category}`}
              href={`/category/${g.category}?${query}`}
              onClick={() => onSelect?.(g.category)}
              data-testid="gap-tile"
              aria-label={`${cat.name}: ${ok ? `${pct(rate)}% gap` : 'not applicable'}`}
              className="gap-tile group relative flex h-full flex-col justify-between overflow-hidden rounded-[var(--radius-card)] bg-raised px-4 py-3 outline-offset-2 transition-[transform] duration-150 hover:-translate-y-0.5 active:translate-y-0"
              style={style}
              transition={{ layout: { duration: 0.5, ease: EASE } }}
            >
              <motion.span
                aria-hidden
                className="absolute inset-y-0 left-0 origin-left"
                style={{ width: `${rate * 100}%`, background: `color-mix(in oklab, var(--c) ${tint}%, transparent)` }}
                initial={reduce ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.9, delay: reduce ? 0 : 0.15 + i * 0.05, ease: EASE }}
              >
                <span className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: 'var(--c)' }} />
              </motion.span>
              {hot && (
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-[var(--radius-card)]"
                  style={{ boxShadow: 'inset 0 0 0 2px var(--c)' }}
                  initial={{ opacity: 0.35 }}
                  animate={reduce ? { opacity: 1 } : { opacity: [0.35, 1, 0.35] }}
                  transition={reduce ? { duration: 0 } : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              <span className="relative flex items-center gap-2 text-[14px] font-medium leading-5">
                {Icon && <Icon size={16} strokeWidth={2} style={{ color: 'var(--c)' }} aria-hidden />}
                <span className="truncate">{cat.short}</span>
              </span>
              <span className="relative flex items-end justify-between gap-2">
                <span className="font-semibold leading-none tracking-[-0.03em]" style={{ fontSize: 'clamp(26px, 4.6svh, 46px)' }}>
                  {ok ? <CountUp value={rate * 100} format={fmt} /> : <span className="text-faint">—</span>}
                  {ok && <span className="ml-0.5 text-[0.5em] font-medium text-muted">%</span>}
                </span>
                {change !== null && Math.abs(change) >= 0.005 && (
                  <span
                    className="num flex items-center gap-0.5 text-[12px] font-medium"
                    style={{ color: change > 0 ? 'var(--negative)' : 'var(--positive)' }}
                    title="vs Q4 2025"
                  >
                    {change > 0 ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />}
                    {pts(change).replace(/^[+−]/, '')}
                  </span>
                )}
              </span>
            </MotionLink>
          </li>
        );
      })}
    </ol>
  );
}
