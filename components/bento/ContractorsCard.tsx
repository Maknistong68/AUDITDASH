'use client';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { CountUp } from '@/components/motion/CountUp';
import { HandoffLink } from '@/components/motion/HandoffLink';
import { Sparkline, trendLabel } from '@/components/charts/Trend';
import { CONTRACTOR_NAME, CONTRACTOR_SCORE } from '@/lib/handoff';
import { bandShort, bandTone, pct } from '@/lib/format';
import type { ContractorCard as Card } from '@/lib/analytics';
import { PRESS, SPRING, TileLabel } from './BentoGrid';

const whole = (n: number) => String(Math.round(n));
const BAND_TICKS = [0.6, 0.7, 0.8, 0.9];

function Row({
  card,
  i,
  animateIn,
  query,
}: {
  query: string;
  card: Card;
  i: number;
  animateIn: boolean;
}) {
  const reduce = useReducedMotion();
  const { contractor, total, band, rank, history } = card;
  const scores = history.map((h) => h.total);
  const tone = bandTone(band);
  const delay = animateIn ? 0.2 + i * 0.04 : 0;
  return (
    <motion.li
      layout={reduce ? false : 'position'}
      initial={reduce ? false : { opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, transition: { duration: 0.15 } }}
      transition={{ ...SPRING, delay }}
      whileTap={reduce ? undefined : { scale: 0.985, transition: PRESS }}
      data-testid="contractor-row"
      data-handoff-card=""
      data-score={total}
      className={`tone-${tone} group relative grid min-h-0 grid-cols-[1.6em_minmax(0,1fr)_3.3em_6.4em] min-[640px]:grid-cols-[1.6em_minmax(0,1.6fr)_minmax(0,1fr)_3.3em_6.4em_60px] items-center gap-x-[clamp(8px,0.9vw,16px)] rounded-[14px] px-[clamp(8px,0.8vw,14px)] transition-colors duration-200 hover:bg-fill-2`}
    >
      <span className="num text-[clamp(13px,1.5svh,15px)] font-semibold text-faint">{rank}</span>
      <span className="flex min-w-0 flex-col justify-center">
        <span className="truncate text-[clamp(14px,1.75svh,18px)] font-semibold leading-tight tracking-[-0.02em]" title={contractor.name}>
          <span data-handoff={CONTRACTOR_NAME}>{contractor.name}</span>
        </span>
        <span className="text-[12px] leading-tight text-muted">{contractor.subregion}</span>
      </span>
      <span className="relative hidden h-[clamp(6px,0.9svh,9px)] rounded-full bg-fill-2 min-[640px]:block" aria-hidden>
        {BAND_TICKS.map((t) => (
          <span key={t} className="absolute inset-y-0 w-[2px] -translate-x-1/2 bg-surface" style={{ left: `${t * 100}%` }} />
        ))}
        <motion.span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${Math.min(1, Math.max(0, total)) * 100}%`, background: 'var(--tone-dot)', transformOrigin: 'left' }}
          initial={reduce ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ type: 'spring', stiffness: 110, damping: 20, delay: delay + 0.1 }}
        />
      </span>
      <span className="figure text-right text-[clamp(20px,3.1svh,34px)]">
        <span data-handoff={CONTRACTOR_SCORE}>
          <CountUp value={total * 100} format={whole} duration={1} delay={delay} />
          <span className="text-[0.5em] tracking-normal text-muted">%</span>
        </span>
      </span>
      <span className="flex justify-start">
        <span className="badge px-2 py-[2px] text-[13px]" title={band}>
          {bandShort(band)}
        </span>
      </span>
      <span className="hidden justify-start min-[640px]:flex" title={`Audit scores, oldest first: ${trendLabel(scores)}`}>
        <Sparkline values={scores} delay={delay + 0.2} />
      </span>
      <HandoffLink
        href={`/contractor/${contractor.id}${query}`}
        aria-label={`${contractor.name}, rank ${rank}, ${pct(total)}%, ${band}`}
        className="absolute inset-0 z-[1] rounded-[14px]"
      />
    </motion.li>
  );
}

/**
 * XL tile: contractors ranked by latest official score, highest first. The whole row is the tap target: it opens the
 * contractor details with the shared hand-off (its name and score morph into the contractor page's title and score, lib/handoff).
 */
export function ContractorsCard({ cards }: { cards: Card[] }) {
  const reduce = useReducedMotion();
  const sp = useSearchParams();
  const firstPaint = useRef(true);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    firstPaint.current = false;
    root.current?.setAttribute('data-hydrated', ''); // rows are live (used by e2e)
  }, []);
  // Carry an explicit filter into the details (the default overview URL stays clean).
  const query = sp.has('q') || sp.has('r') ? `?${new URLSearchParams([...sp].filter(([k]) => k === 'q' || k === 'r')).toString()}` : '';

  return (
    <motion.section
      ref={root}
      data-testid="contractors"
      aria-labelledby="contractors-title"
      initial={reduce ? false : { opacity: 0, y: 22, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...SPRING, delay: 0.05 }}
      className="card flex min-h-0 min-w-0 flex-col px-[clamp(10px,1vw,18px)] pb-[clamp(8px,1.2svh,16px)] pt-[clamp(12px,1.8svh,24px)]"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-[clamp(8px,0.8vw,14px)] pb-[clamp(4px,1svh,12px)]">
        <div className="flex items-baseline gap-2.5">
          <h2 id="contractors-title" className="text-[clamp(20px,2.7svh,30px)] font-semibold tracking-[-0.03em]">
            Contractors
          </h2>
          <span className="num text-[clamp(15px,2svh,20px)] font-semibold text-faint">{cards.length}</span>
        </div>
        <TileLabel className="!font-normal">
          Latest Total Final Score · trend
        </TileLabel>
      </div>
      <ul className="grid min-h-0 flex-1 auto-rows-[minmax(44px,1fr)] min-[1200px]:auto-rows-[minmax(0,1fr)]">
        <AnimatePresence mode="popLayout" initial={!reduce}>
          {cards.map((card, i) => (
            <Row key={card.contractor.id} card={card} i={i} animateIn={firstPaint.current} query={query} />
          ))}
        </AnimatePresence>
      </ul>
    </motion.section>
  );
}
