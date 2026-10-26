'use client';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { categoryById } from '@/lib/categories';
import { pct } from '@/lib/format';
import type { CategoryId } from '@/lib/types';
import { CATEGORY_ICONS } from './categoryIcons';

export interface GapRow { category: CategoryId; gapRate: number | null; prevGapRate: number | null }
export interface WorstContractor { id: string; name: string; gapRate: number }

const MotionLink = motion.create(Link);
const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * "Where it fails": the ten categories ranked worst first as horizontal gap bars in the one accent
 * (gap = score-based, 0 = no gap, 1 = total gap; bar length is the gap on a 0–100% scale). The worst three
 * carry the full accent and a pulsing end-dot; the rest a lighter step of the same hue. Hover/focus grows
 * the row (CSS) to show the three worst contractors in that category. Rows re-sort with a layout morph.
 */
export function GapRadar({
  gaps, query, worst, onSelect, delay = 0.25,
}: {
  gaps: GapRow[]; query: string; worst: Partial<Record<CategoryId, WorstContractor[]>>;
  onSelect?: (c: CategoryId) => void; delay?: number;
}) {
  const reduce = useReducedMotion();
  const ranked = [...gaps].sort((a, b) => (b.gapRate ?? -1) - (a.gapRate ?? -1));
  const top3 = new Set(ranked.filter((g) => g.gapRate !== null).slice(0, 3).map((g) => g.category));

  return (
    <ol className="gap-list flex min-h-0 flex-1 flex-col">
      {ranked.map((g, i) => {
        const cat = categoryById(g.category);
        const Icon = CATEGORY_ICONS[cat.icon];
        const ok = g.gapRate !== null;
        const rate = ok ? g.gapRate! : 0;
        const change = ok && g.prevGapRate !== null ? Math.round((rate - g.prevGapRate) * 100) : null;
        const hot = top3.has(g.category);
        const chips = (worst[g.category] ?? []).slice(0, 3);
        return (
          <li key={g.category} className="contents">
            <MotionLink
              layoutId={`cat-${g.category}`}
              href={`/category/${g.category}?${query}`}
              onClick={() => onSelect?.(g.category)}
              data-testid="gap-tile"
              aria-label={`${cat.name}: ${ok ? `${pct(rate)}% gap` : 'not applicable'}${chips.length ? `. Worst: ${chips.map((c) => c.name).join(', ')}` : ''}`}
              className="gap-row group relative flex min-h-[36px] flex-col justify-center overflow-hidden border-b border-rule outline-offset-[-2px] last:border-b-0"
              transition={{ layout: { duration: 0.55, ease: EASE } }}
            >
              <span className="grid grid-cols-[20px_minmax(120px,13rem)_1fr_7.5rem] items-center gap-x-4">
                {Icon ? <Icon size={17} strokeWidth={1.75} className="text-muted transition-colors group-hover:text-ink" aria-hidden /> : <span />}
                <span className="truncate text-[15px] font-medium tracking-[-0.005em]">{cat.short}</span>
                <span className="relative h-2" aria-hidden>
                  <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-rule" />
                  <motion.span
                    className="absolute inset-y-0 left-0 origin-left rounded-full"
                    style={{
                      width: `${rate * 100}%`,
                      background: hot ? 'var(--gap-hue)' : 'color-mix(in oklab, var(--gap-hue) 50%, var(--ground))',
                    }}
                    initial={reduce ? false : { scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: reduce ? 0 : 0.75, delay: reduce ? 0 : delay + i * 0.05, ease: EASE }}
                  />
                  {hot && ok && (
                    <motion.span
                      className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
                      style={{ left: `${rate * 100}%` }}
                      initial={{ scale: 1, opacity: 0 }}
                      animate={reduce ? { opacity: 0 } : { scale: [1, 2.6], opacity: [0.55, 0] }}
                      transition={reduce ? { duration: 0 } : { duration: 1.8, repeat: Infinity, ease: 'easeOut', delay: delay + 1 }}
                    />
                  )}
                </span>
                <span className="num flex items-baseline justify-end gap-2 whitespace-nowrap">
                  {change !== null && change !== 0 && (
                    <span className="inline-flex items-center text-[12px] font-medium" style={{ color: change > 0 ? 'var(--gap-hue)' : 'var(--positive)' }} title="vs Q4 2025">
                      {change > 0 ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />}
                      {Math.abs(change)}
                    </span>
                  )}
                  <span className="text-[22px] font-semibold leading-none tracking-[-0.02em]">
                    {ok ? pct(rate) : <span className="text-faint">—</span>}
                    {ok && <span className="text-[13px] font-medium tracking-normal text-muted">% gap</span>}
                  </span>
                </span>
              </span>
              {chips.length > 0 && (
                <span className="gap-chips-wrap grid">
                  <span className="min-h-0 overflow-hidden">
                    <span className="gap-chips flex flex-wrap gap-2 pt-2.5 pl-9">
                      {chips.map((c) => (
                        <span
                          key={c.id}
                          data-testid="gap-chip"
                          className="num inline-flex max-w-[15rem] items-center gap-2 rounded-full border border-rule bg-surface px-3 py-1 text-[12px]"
                        >
                          <span className="truncate">{c.name}</span>
                          <span className="font-semibold">{pct(c.gapRate)}%</span>
                        </span>
                      ))}
                    </span>
                  </span>
                </span>
              )}
            </MotionLink>
          </li>
        );
      })}
    </ol>
  );
}
