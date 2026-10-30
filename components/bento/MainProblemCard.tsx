'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowUp, ChevronRight } from 'lucide-react';
import { CountUp } from '@/components/motion/CountUp';
import { categoryById } from '@/lib/categories';
import { QUARTERS } from '@/lib/filters';
import { pct } from '@/lib/format';
import { HandoffLink } from '@/components/motion/HandoffLink';
import { HANDOFF } from '@/lib/handoff';
import { itemLabel } from '@/lib/itemLabels';
import type { CategoryId, Quarter } from '@/lib/types';
import { SPRING } from './BentoGrid';
import { calm, QUICK, STAGGER } from '@/lib/motion';

export interface MainProblem {
  category: CategoryId;
  gapRate: number;
  prevGapRate: number | null;
  quarter: Quarter | 'all';
  items: { itemCode: string; question: string; hits: number; severity?: number }[];
}

export const qLabel = (q: Quarter | 'all') => (q === 'all' ? 'All audits' : q.replace('-', ' '));
export const prevLabel = (q: Quarter | 'all') => {
  const i = q === 'all' ? -1 : QUARTERS.indexOf(q);
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
export function MainProblemCard({ problem, audits, query, ranking }: {
  problem: MainProblem; audits: number; query: string;
  /** Every category's score lost, worst first: the card's hover layer. */
  ranking?: { category: CategoryId; gapRate: number }[];
}) {
  const reduce = useReducedMotion();
  const cat = categoryById(problem.category);
  const url = `/category/${problem.category}?${query}`;
  return (
    <motion.section
      data-testid="main-problem"
      data-handoff={HANDOFF}
      data-handoff-card=""
      aria-labelledby="mp-title"
      initial={reduce ? false : { opacity: 0, y: 22, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...SPRING, delay: 0.12 }}
      whileHover={reduce ? undefined : { y: -4, transition: QUICK }}
      whileTap={reduce ? undefined : { scale: 0.99, y: -1 }}
      className="hero-tile lift reveal-host group relative col-span-full flex min-h-0 min-w-0 rounded-[var(--radius-card)]"
    >
      <HandoffLink
        href={url}
        aria-label={`Main problem ${qLabel(problem.quarter)}: ${cat.name}, ${pct(problem.gapRate)}% score lost. Open details`}
        className="absolute inset-0 z-[2] rounded-[var(--radius-card)]"
      />
      <ProblemCardContent problem={problem} audits={audits} label="Main problem" ranking={ranking} />
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
  ranking,
}: {
  ranking?: { category: CategoryId; gapRate: number }[];
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
              {countUp ? <CountUp value={problem.gapRate * 100} format={whole} delay={0.3} /> : whole(problem.gapRate * 100)}
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

      <div className={`min-h-0 min-w-0 ${ranking ? 'swap content-center' : 'flex flex-col justify-center'}`}>
        <Drivers problem={problem} audits={audits} className={ranking ? 'swap-a' : ''} />
        {ranking && <Ranking ranking={ranking} current={problem.category} />}
      </div>
    </div>
  );
}

/** "Driven by": the top 3 questions behind the problem, each a thin bar of the audits that noted it. */
function Drivers({ problem, audits, className = '' }: { problem: MainProblem; audits: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <div className={`flex flex-col justify-center gap-[clamp(6px,1.2svh,14px)] ${className}`}>
      <p className="text-[13px] font-semibold" style={{ color: 'var(--hero-muted)' }}>
        Driven by
      </p>
      <ol className="flex flex-col gap-[clamp(8px,1.5svh,16px)]">
        {problem.items.map((it, k) => (
          <li
            key={it.itemCode}
            data-testid="main-problem-driver"
            className="flex flex-col gap-1.5"
            title={`${it.question} (noted in ${it.hits} of ${audits} audits)`}
          >
            <span className="flex items-baseline justify-between gap-2.5">
              <span className="line-clamp-1 text-[clamp(13px,1.55svh,15px)] leading-snug">{itemLabel(it.itemCode, it.question)}</span>
              <span className="num shrink-0 whitespace-nowrap text-[13px]" style={{ color: 'var(--hero-muted)' }}>
                <span className="font-semibold" style={{ color: 'var(--hero-text)' }}>{it.hits}</span>/{audits}
              </span>
            </span>
            <span className="block h-[5px] overflow-hidden rounded-full" style={{ background: 'var(--hero-chip)' }} aria-hidden>
              <motion.span
                className="block h-full rounded-full"
                style={{ width: `${audits ? (it.hits / audits) * 100 : 0}%`, background: 'var(--hero-accent)', transformOrigin: 'left' }}
                initial={reduce ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={calm(0.45 + k * STAGGER)}
              />
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The hover layer: every category's score lost, worst first, the main problem highlighted. */
function Ranking({ ranking, current }: { ranking: { category: CategoryId; gapRate: number }[]; current: CategoryId }) {
  const max = Math.max(...ranking.map((r) => r.gapRate), 0.01);
  return (
    <div data-testid="main-problem-ranking" className="swap-b flex flex-col justify-center gap-[clamp(4px,0.8svh,9px)]" aria-hidden>
      <p className="text-[13px] font-semibold" style={{ color: 'var(--hero-muted)' }}>
        Score lost · all categories
      </p>
      <ol className="flex flex-col gap-[clamp(3px,0.6svh,7px)]">
        {ranking.map((r) => {
          const on = r.category === current;
          return (
            <li key={r.category} className="grid grid-cols-[minmax(0,7.5em)_minmax(0,1fr)_2.4em] items-center gap-2 text-[12.5px]">
              <span className="truncate" style={{ color: on ? 'var(--hero-text)' : 'var(--hero-muted)', fontWeight: on ? 600 : 400 }}>
                {categoryById(r.category).short}
              </span>
              <span className="block h-[5px] rounded-full" style={{ background: 'var(--hero-chip)' }}>
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${(r.gapRate / max) * 100}%`, background: on ? 'var(--hero-accent)' : 'var(--hero-muted)', opacity: on ? 1 : 0.55 }}
                />
              </span>
              <span className="num text-right font-semibold" style={{ color: on ? 'var(--hero-accent)' : 'var(--hero-text)' }}>{pct(r.gapRate)}%</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
