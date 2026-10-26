'use client';
import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ChevronRight } from 'lucide-react';
import { CountUp } from '@/components/motion/CountUp';
import { categoryById } from '@/lib/categories';
import { QUARTERS } from '@/lib/filters';
import { pct } from '@/lib/format';
import type { CategoryId, Quarter } from '@/lib/types';
import { SPRING } from './BentoGrid';

export interface MainProblem {
  category: CategoryId;
  gapRate: number;
  prevGapRate: number | null;
  quarter: Quarter;
  items: { itemCode: string; question: string; hits: number }[];
}

const qLabel = (q: Quarter) => q.replace('-', ' ');
const prevLabel = (q: Quarter) => {
  const i = QUARTERS.indexOf(q);
  return i > 0 ? QUARTERS[i - 1].slice(0, 2) : null;
};
const whole = (n: number) => String(Math.round(n));

/**
 * L tile, the right side's hero: this quarter's worst category by score-based gap. Inverted (dark) Apple tile.
 * Gap % large, Δ vs previous quarter (a rising gap is bad → red; falling → green), top 3 driving items.
 * The whole tile opens the category details.
 */
export function MainProblemCard({ problem, audits, query }: { problem: MainProblem; audits: number; query: string }) {
  const reduce = useReducedMotion();
  const cat = categoryById(problem.category);
  const d = problem.prevGapRate === null ? null : Math.round(problem.gapRate * 100) - Math.round(problem.prevGapRate * 100);
  const vs = prevLabel(problem.quarter);
  return (
    <motion.section
      data-testid="main-problem"
      aria-labelledby="mp-title"
      initial={reduce ? false : { opacity: 0, y: 22, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...SPRING, delay: 0.12 }}
      className="hero-tile lift group relative col-span-full flex min-h-0 min-w-0 rounded-[var(--radius-card)]"
    >
      <Link
        href={`/category/${problem.category}?${query}`}
        aria-label={`Main problem ${qLabel(problem.quarter)}: ${cat.name}, gap ${pct(problem.gapRate)}%. Open details`}
        className="absolute inset-0 z-[2] rounded-[var(--radius-card)]"
      />
      <div className="grid min-h-0 w-full grid-cols-1 gap-x-[clamp(20px,2.4vw,48px)] gap-y-4 p-[clamp(16px,2.2svh,30px)] min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="flex min-h-0 min-w-0 flex-col justify-between gap-2">
          <div className="flex flex-col gap-[clamp(4px,0.8svh,10px)]">
            <p className="text-[clamp(13px,1.5svh,16px)] font-semibold" style={{ color: 'var(--hero-accent)' }}>
              Main problem · {qLabel(problem.quarter)}
            </p>
            <h2 id="mp-title" className="text-[clamp(24px,3.7svh,42px)] font-semibold leading-[1.05] tracking-[-0.03em]">
              {cat.name}
            </h2>
          </div>
          <div className="flex items-end gap-[clamp(10px,1vw,18px)]">
            <p className="figure text-[clamp(52px,9svh,104px)]" style={{ color: 'var(--hero-accent)' }}>
              <CountUp value={problem.gapRate * 100} format={whole} duration={1.2} delay={0.3} />
              <span className="text-[0.42em] tracking-normal">%</span>
            </p>
            <div className="flex flex-col gap-1 pb-[0.6em] text-[clamp(13px,1.5svh,15px)]">
              <span style={{ color: 'var(--hero-muted)' }}>gap</span>
              {d !== null && (
                <span
                  className="num inline-flex items-center gap-0.5 font-semibold"
                  style={{ color: d < 0 ? 'var(--hero-up)' : d > 0 ? 'var(--hero-down)' : 'var(--hero-muted)' }}
                  title={`Gap ${pct(problem.gapRate)}% in ${qLabel(problem.quarter)} vs ${pct(problem.prevGapRate)}% the quarter before`}
                >
                  {d > 0 && <ArrowUp size={14} strokeWidth={2.6} aria-hidden />}
                  {d < 0 && <ArrowDown size={14} strokeWidth={2.6} aria-hidden />}
                  {d > 0 ? '+' : d < 0 ? '−' : '±'}
                  {Math.abs(d)} {Math.abs(d) === 1 ? 'pt' : 'pts'}
                  <span className="ml-1 font-normal" style={{ color: 'var(--hero-muted)' }}>
                    vs {vs}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-col justify-center gap-[clamp(6px,1.2svh,14px)]">
          <p className="text-[13px] font-semibold" style={{ color: 'var(--hero-muted)' }}>
            Driven by
          </p>
          <ol className="flex flex-col gap-[clamp(6px,1.3svh,14px)]">
            {problem.items.map((it) => (
              <li key={it.itemCode} className="grid grid-cols-[3.2em_minmax(0,1fr)_auto] items-baseline gap-2.5" title={it.question}>
                <span className="num rounded-md px-1.5 py-[1px] text-center text-[12px] font-semibold" style={{ background: 'var(--hero-chip)', color: 'var(--hero-muted)' }}>
                  {it.itemCode}
                </span>
                <span className="line-clamp-2 text-[clamp(13px,1.55svh,15px)] leading-snug">{it.question}</span>
                <span className="num whitespace-nowrap text-[13px]" style={{ color: 'var(--hero-muted)' }}>
                  <span className="font-semibold" style={{ color: 'var(--hero-text)' }}>{it.hits}</span>/{audits}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <span
        aria-hidden
        className="absolute right-[clamp(12px,1.6svh,22px)] top-[clamp(12px,1.6svh,22px)] grid size-9 place-items-center rounded-full transition-transform duration-300 group-hover:translate-x-0.5"
        style={{ background: 'var(--hero-chip)' }}
      >
        <ChevronRight size={18} strokeWidth={2.4} />
      </span>
    </motion.section>
  );
}
