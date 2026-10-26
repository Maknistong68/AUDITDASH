'use client';
import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { ArrowDown, ArrowUp, ChevronRight } from 'lucide-react';
import { CountUp } from '@/components/motion/CountUp';
import { categoryById } from '@/lib/categories';
import { QUARTERS } from '@/lib/filters';
import { pct } from '@/lib/format';
import { canHandOff, handOff } from '@/lib/handoff';
import { itemLabel } from '@/lib/itemLabels';
import type { CategoryId, Quarter } from '@/lib/types';
import { SPRING } from './BentoGrid';

export interface MainProblem {
  category: CategoryId;
  gapRate: number;
  prevGapRate: number | null;
  quarter: Quarter;
  items: { itemCode: string; question: string; hits: number; severity?: number }[];
}

export const qLabel = (q: Quarter) => q.replace('-', ' ');
export const prevLabel = (q: Quarter) => {
  const i = QUARTERS.indexOf(q);
  return i > 0 ? QUARTERS[i - 1].slice(0, 2) : null;
};
const whole = (n: number) => String(Math.round(n));
/**
 * The gap figure fills what the left column leaves beside the "gap" / Δ labels (100cqw = that space, an @container),
 * capped by the tile's height (16svh) so it never clips in the one-viewport bento. A figure is ~0.6em per digit
 * plus ~0.5em for the small "%".
 */
const figureSize = (gapRate: number) =>
  `clamp(52px, min(calc(100cqw / ${(0.6 * String(Math.round(gapRate * 100)).length + 0.5).toFixed(2)}), 16svh), 220px)`;

/**
 * L tile, the right side's hero: this quarter's worst category by score-based gap. Inverted (dark) Apple tile.
 * Gap % large, Δ vs previous quarter (a rising gap is bad → red; falling → green), top 3 driving items
 * (ranked by impact: audits noted × subsection score lost), each as a short plain label and "N of M audits"
 * (audits with an auditor note). No item codes here; they stay on the detail pages.
 * The whole tile opens the category details; where view transitions run (and motion is allowed) the tile itself travels
 * and shrinks into the category page's active carousel card (lib/handoff).
 */
export function MainProblemCard({ problem, audits, query }: { problem: MainProblem; audits: number; query: string }) {
  const reduce = useReducedMotion();
  const cat = categoryById(problem.category);
  const router = useRouter();
  const tile = useRef<HTMLElement>(null);
  const url = `/category/${problem.category}?${query}`;
  // Fetch the category page ahead, so the hand-off starts without a wait.
  useEffect(() => router.prefetch(url), [router, url]);
  const onClick = (e: React.MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !tile.current || !canHandOff()) return;
    e.preventDefault();
    handOff(tile.current, () => router.push(url));
  };
  return (
    <motion.section
      ref={tile}
      data-testid="main-problem"
      aria-labelledby="mp-title"
      initial={reduce ? false : { opacity: 0, y: 22, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...SPRING, delay: 0.12 }}
      whileHover={reduce ? undefined : { y: -4, transition: { type: 'spring', stiffness: 400, damping: 28 } }}
      whileTap={reduce ? undefined : { scale: 0.99, y: -1 }}
      className="hero-tile lift group relative col-span-full flex min-h-0 min-w-0 rounded-[var(--radius-card)]"
    >
      <Link
        href={url}
        onClick={onClick}
        aria-label={`Main problem ${qLabel(problem.quarter)}: ${cat.name}, gap ${pct(problem.gapRate)}%. Open details`}
        className="absolute inset-0 z-[2] rounded-[var(--radius-card)]"
      />
      <ProblemCardContent problem={problem} audits={audits} label="Main problem" />
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

/**
 * The card's content (both columns), shared by the dashboard tile and the category page's card: label line
 * ("<label> · Q1 2026"), category name, gap %, Δ vs the previous quarter, top 3 driving items with "N of M audits".
 */
export function ProblemCardContent({
  problem,
  audits,
  label,
  headingId = 'mp-title',
  as: Heading = 'h2',
  countUp = true,
}: {
  problem: MainProblem;
  audits: number;
  label: string;
  headingId?: string;
  as?: 'h1' | 'h2';
  /** false: the gap figure is shown at once (a card swapped in on the category page). */
  countUp?: boolean;
}) {
  const cat = categoryById(problem.category);
  const d = problem.prevGapRate === null ? null : Math.round(problem.gapRate * 100) - Math.round(problem.prevGapRate * 100);
  const vs = prevLabel(problem.quarter);
  return (
    <div className="grid min-h-0 w-full grid-cols-1 gap-x-[clamp(20px,2.4vw,48px)] gap-y-4 p-[clamp(16px,2.2svh,30px)] min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex min-h-0 min-w-0 flex-col justify-between gap-2">
        <div className="flex flex-col gap-[clamp(4px,0.8svh,10px)]">
          <p className="text-[clamp(13px,1.5svh,16px)] font-semibold" style={{ color: 'var(--hero-accent)' }}>
            {`${label} · ${qLabel(problem.quarter)}`}
          </p>
          <Heading id={headingId} className="text-[clamp(24px,3.7svh,42px)] font-semibold leading-[1.05] tracking-[-0.03em]">
            {cat.name}
          </Heading>
        </div>
        <div className="flex items-end gap-[clamp(10px,1vw,18px)]">
          <div className="@container min-w-0 flex-1">
            <p data-testid="main-problem-gap" className="figure" style={{ color: 'var(--hero-accent)', fontSize: figureSize(problem.gapRate) }}>
              {countUp ? <CountUp value={problem.gapRate * 100} format={whole} duration={1.2} delay={0.3} /> : whole(problem.gapRate * 100)}
              <span className="text-[0.42em] tracking-normal">%</span>
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-1 whitespace-nowrap pb-[0.6em] text-[clamp(13px,1.5svh,15px)]">
            <span style={{ color: 'var(--hero-muted)' }}>score lost</span>
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
            <li
              key={it.itemCode}
              data-testid="main-problem-driver"
              className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2.5"
              title={`${it.question} (noted in ${it.hits} of ${audits} audits)`}
            >
              <span className="line-clamp-2 text-[clamp(13px,1.55svh,15px)] leading-snug">{itemLabel(it.itemCode, it.question)}</span>
              <span className="num whitespace-nowrap text-[13px]" style={{ color: 'var(--hero-muted)' }}>
                <span className="font-semibold" style={{ color: 'var(--hero-text)' }}>{it.hits}</span> of {audits} audits
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
