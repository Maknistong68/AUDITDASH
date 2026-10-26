'use client';
import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { ArrowDown, ArrowUp, ChevronRight } from 'lucide-react';
import { CountUp } from '@/components/motion/CountUp';
import { CATEGORY_ICONS } from '@/components/charts/categoryIcons';
import { CATEGORY_COLORS_DARK, categoryById } from '@/lib/categories';
import { QUARTERS } from '@/lib/filters';
import { pct } from '@/lib/format';
import { handoff } from '@/lib/handoff';
import type { CategoryId, Quarter } from '@/lib/types';
import { SPRING } from './BentoGrid';

export interface MainProblem {
  category: CategoryId;
  gapRate: number;
  prevGapRate: number | null;
  quarter: Quarter;
}
export interface Driver { category: CategoryId; gapRate: number; share: number }

const qLabel = (q: Quarter) => q.replace('-', ' ');
const prevLabel = (q: Quarter) => {
  const i = QUARTERS.indexOf(q);
  return i > 0 ? QUARTERS[i - 1].slice(0, 2) : null;
};
const whole = (n: number) => String(Math.round(n));

/** Driver row columns: icon · name · severity bar · gap % · share of lost score. Shared by the header row. */
const ROW =
  'grid grid-cols-[20px_minmax(0,1fr)_40px_36px_52px] min-[640px]:grid-cols-[20px_minmax(0,1.25fr)_minmax(56px,1fr)_44px_88px] items-center gap-x-[clamp(8px,1vw,18px)]';

/**
 * The dashboard's standout tile (inverted in light mode, accent-ringed warm surface in dark mode). Answers "what is
 * this quarter's main problem, and which categories drive it": the worst category by score-based gap, its gap % with
 * Δ vs the previous quarter (a rising gap is bad → red), and the top 4 categories by share of the quarter's lost
 * score (gapContribution) as ranked rows — icon in the category's colour, severity bar (gap) in the single gap hue,
 * share % — each linking to its category. The tile body opens the main problem's category with a view-transition
 * hand-off (the tile morphs into the category header; instant under reduced motion / without the API).
 * Layout: header (title, category, gap figure) on top, Driven By as a full-width block whose rows share the
 * remaining height, so the tile has no internal void at any height.
 */
export function MainProblemCard({ problem, drivers, query }: { problem: MainProblem; drivers: Driver[]; query: string }) {
  const reduce = useReducedMotion();
  const router = useRouter();
  const tile = useRef<HTMLElement>(null);
  const name = useRef<HTMLHeadingElement>(null);
  const cat = categoryById(problem.category);
  const d = problem.prevGapRate === null ? null : Math.round(problem.gapRate * 100) - Math.round(problem.prevGapRate * 100);
  const vs = prevLabel(problem.quarter);
  const url = `/category/${problem.category}?${query}`;
  const title = `Main Problem – ${qLabel(problem.quarter)}`;

  const open = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    handoff(router.push, url, [[tile.current, 'mp-hero'], [name.current, 'mp-name']]);
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
      whileTap={reduce ? undefined : { scale: 0.995, y: -1 }}
      className="hero-tile lift group relative col-span-full flex min-h-0 min-w-0 flex-col rounded-[var(--radius-card)]"
    >
      <Link
        href={url}
        onClick={open}
        data-testid="main-problem-open"
        aria-label={`${title}: ${cat.name}, gap ${pct(problem.gapRate)}%. Open the controller view`}
        className="absolute inset-0 z-[2] rounded-[var(--radius-card)]"
      />
      <div className="flex min-h-0 flex-1 flex-col gap-[clamp(8px,1.5svh,22px)] px-[clamp(18px,1.8vw,34px)] py-[clamp(14px,2svh,28px)]">
        <header data-block className="flex flex-col gap-x-6 gap-y-1 min-[640px]:flex-row min-[640px]:items-end min-[640px]:justify-between">
          <div className="flex min-w-0 flex-col gap-[clamp(2px,0.6svh,8px)]">
            <p data-testid="main-problem-title" className="flex items-center gap-1.5 text-[clamp(13px,1.5svh,16px)] font-semibold" style={{ color: 'var(--hero-accent)' }}>
              {title}
              <ChevronRight size={16} strokeWidth={2.6} aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5" />
            </p>
            <h2 ref={name} id="mp-title" className="text-[clamp(24px,3.9svh,46px)] font-semibold leading-[1.04] tracking-[-0.03em]">
              {cat.name}
            </h2>
          </div>
          <div className="flex shrink-0 items-end gap-[clamp(8px,0.8vw,14px)]">
            <p className="figure text-[clamp(48px,8.2svh,100px)]" style={{ color: 'var(--hero-accent)' }}>
              <CountUp value={problem.gapRate * 100} format={whole} duration={1.2} delay={0.3} />
              <span className="text-[0.42em] tracking-normal">%</span>
            </p>
            <div className="flex flex-col gap-0.5 pb-[0.45em] text-[clamp(12px,1.45svh,15px)]">
              <span style={{ color: 'var(--hero-muted)' }}>gap</span>
              {d !== null && (
                <span
                  data-testid="main-problem-delta"
                  className="num inline-flex items-center gap-0.5 whitespace-nowrap font-semibold"
                  style={{ color: d < 0 ? 'var(--hero-up)' : d > 0 ? 'var(--hero-down)' : 'var(--hero-muted)' }}
                  title={`Gap ${pct(problem.gapRate)}% in ${qLabel(problem.quarter)} vs ${pct(problem.prevGapRate)}% the quarter before`}
                >
                  {d > 0 && <ArrowUp size={13} strokeWidth={2.6} aria-hidden />}
                  {d < 0 && <ArrowDown size={13} strokeWidth={2.6} aria-hidden />}
                  {d > 0 ? '+' : d < 0 ? '−' : '±'}
                  {Math.abs(d)} {Math.abs(d) === 1 ? 'pt' : 'pts'}
                  <span className="ml-1 font-normal" style={{ color: 'var(--hero-muted)' }}>
                    vs {vs}
                  </span>
                </span>
              )}
            </div>
          </div>
        </header>

        {drivers.length > 0 && (
          <div data-testid="drivers" className="flex min-h-0 flex-1 flex-col">
            <div data-block className={`${ROW} pb-[clamp(4px,0.7svh,8px)] text-[12px] font-medium`} style={{ color: 'var(--hero-muted)' }}>
              <span className="col-span-3 text-[clamp(13px,1.45svh,15px)] font-semibold" style={{ color: 'var(--hero-text)' }}>Driven by</span>
              <span className="text-right">gap</span>
              <span className="whitespace-nowrap text-right"><span className="min-[640px]:hidden">share</span><span className="max-[639px]:hidden">of lost score</span></span>
            </div>
            <ol className="flex min-h-0 flex-1 flex-col">
              {drivers.map((r) => {
                const c = categoryById(r.category);
                const Icon = CATEGORY_ICONS[c.icon];
                return (
                  <li key={r.category} data-block className="flex min-h-[26px] flex-1 border-t" style={{ borderColor: 'var(--hero-rule)' }}>
                    <Link
                      href={`/category/${r.category}?${query}`}
                      data-testid="driver-row"
                      data-category={r.category}
                      data-share={r.share}
                      aria-label={`${c.name}: ${pct(r.share)}% of lost score, gap ${pct(r.gapRate)}%`}
                      className={`${ROW} relative z-[3] -mx-2 w-[calc(100%+16px)] rounded-xl px-2 transition-colors duration-200 hover:bg-[var(--hero-chip)] focus-visible:bg-[var(--hero-chip)]`}
                    >
                      {Icon ? <Icon size={18} strokeWidth={2.2} aria-hidden style={{ color: CATEGORY_COLORS_DARK[c.id] }} /> : <span />}
                      <span className="truncate text-[clamp(13px,1.6svh,17px)] font-medium"><span className="min-[640px]:hidden">{c.short}</span><span className="max-[639px]:hidden">{c.name}</span></span>
                      <span className="h-[clamp(5px,0.75svh,8px)] overflow-hidden rounded-full" style={{ background: 'var(--hero-chip)' }} aria-hidden>
                        <motion.span
                          className="block h-full rounded-full"
                          style={{ background: 'var(--hero-gap)', width: `${Math.min(100, r.gapRate * 100)}%`, transformOrigin: 'left' }}
                          initial={reduce ? false : { scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ ...SPRING, delay: 0.35 }}
                        />
                      </span>
                      <span className="num text-right text-[clamp(12px,1.45svh,15px)]" style={{ color: 'var(--hero-muted)' }}>
                        {pct(r.gapRate)}%
                      </span>
                      <span data-testid="driver-share" className="num text-right text-[clamp(15px,2svh,22px)] font-semibold tracking-[-0.02em]">
                        {pct(r.share)}
                        <span className="text-[0.62em] font-medium" style={{ color: 'var(--hero-muted)' }}>%</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>
    </motion.section>
  );
}
