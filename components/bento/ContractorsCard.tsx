'use client';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { usePathname, useSearchParams } from 'next/navigation';
import { ArrowDown, ArrowUp, Check, Plus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CountUp } from '@/components/motion/CountUp';
import { HandoffLink } from '@/components/motion/HandoffLink';
import { CompareTray, type CompareEntry } from '@/components/sections/CompareTray';
import { MAX_COMPARE, parseCompare, toggleCompare, withCompare } from '@/lib/compare';
import { Sparkline, trendLabel } from '@/components/charts/Trend';
import { CONTRACTOR_NAME, CONTRACTOR_SCORE } from '@/lib/handoff';
import { bandShort, bandTone, deltaPoints, pct, prevQuarterShort } from '@/lib/format';
import type { ContractorCard as Card } from '@/lib/analytics';
import { SPRING, TileLabel } from './BentoGrid';
import { Signed } from './parts';
import { calm, DUR, EASE, QUICK, RISE } from '@/lib/motion';

const whole = (n: number) => String(Math.round(n));
const BAND_TICKS = [0.6, 0.7, 0.8, 0.9];

/** Δ in whole points vs the previous audit (computed from the displayed totals); nothing without a previous. Used by the compare tray. */
export function Delta({ total, previous, auditId, size = 13 }: { total: number; previous: number | null; auditId: string; size?: number }) {
  const d = deltaPoints(total, previous);
  if (d === null) return null;
  const vs = prevQuarterShort(auditId);
  const color = d > 0 ? 'var(--up)' : d < 0 ? 'var(--down)' : 'var(--muted)';
  return (
    <span
      className="num inline-flex items-center gap-0.5 font-semibold"
      style={{ color, fontSize: size }}
      title={`${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)} points vs ${vs ?? 'previous audit'} (${pct(previous)}%)`}
    >
      {d > 0 && <ArrowUp size={size} strokeWidth={2.6} aria-hidden />}
      {d < 0 && <ArrowDown size={size} strokeWidth={2.6} aria-hidden />}
      <span>
        {d > 0 ? '+' : d < 0 ? '−' : '±'}
        {Math.abs(d)}
      </span>
      {vs && <span className="ml-0.5 font-normal text-muted">vs {vs}</span>}
    </span>
  );
}

/** The row's second layer, shown while the cursor rests on it: last audit, change, A/B/C and every audit score. */
function Peek({ card, top, h }: { card: Card; top: number; h: number }) {
  const { contractor, total, band, rings, previous, history } = card;
  const d = deltaPoints(total, previous);
  const last = history.at(-1);
  const below = top < 160; // near the top: open below the row, else above it
  const SECTIONS = [['A', 'Management'], ['B', 'Site processes'], ['C', 'Planning']] as const;
  return (
    <motion.div
      data-testid="contractor-peek"
      aria-hidden
      initial={{ opacity: 0, y: below ? -6 : 6, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)', top: below ? top + h + 4 : top - 4 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ ...QUICK, top: { type: 'tween', ease: EASE, duration: 0.45 } }}
      style={{ top: below ? top + h + 4 : top - 4, translateY: below ? 0 : '-100%' }}
      className={`tone-${bandTone(band)} glass pointer-events-none absolute right-[clamp(36px,3vw,52px)] z-20 w-[min(300px,70%)] rounded-[16px] px-4 py-3 shadow-[var(--shadow-lift)]`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[14px] font-semibold">{contractor.name}</span>
        <span className="badge shrink-0 px-2 py-[1px] text-[11.5px]">{bandShort(band)}</span>
      </div>
      <p className="mt-0.5 text-[12px] text-muted">
        {contractor.subregion} · {history.length} {history.length === 1 ? 'audit' : 'audits'}
        {last && <> · last {last.date.slice(8, 10)}/{last.date.slice(5, 7)}/{last.date.slice(2, 4)}</>}
      </p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <span className="figure text-[34px]">
          {pct(total)}<span className="text-[0.45em] tracking-normal text-muted">%</span>
        </span>
        {d !== null ? <Signed d={d} /> : <span className="text-[12px] text-faint">first audit</span>}
        <Sparkline values={history.map((x) => x.total)} width={84} height={30} />
      </div>
      <ul className="mt-2.5 flex flex-col gap-1.5">
        {SECTIONS.map(([k, name]) => {
          const v = rings[k];
          return (
            <li key={k} className="grid grid-cols-[92px_minmax(0,1fr)_26px] items-center gap-2 text-[11.5px]">
              <span className="text-muted">{name}</span>
              <span className="h-[5px] rounded-full bg-fill-2">
                {v !== null && <span className="block h-full rounded-full bg-[var(--bar)]" style={{ width: `${v * 100}%` }} />}
              </span>
              <span className="num text-right font-semibold">{pct(v)}</span>
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}

function Row({
  card,
  i,
  selected,
  disabled,
  onToggle,
  animateIn,
  query,
  onHover,
}: {
  query: string;
  onHover: (id: string | null, el?: HTMLElement) => void;
  card: Card;
  i: number;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
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
      data-testid="contractor-row"
      data-handoff-card=""
      data-score={total}
      onMouseEnter={(e) => onHover(contractor.id, e.currentTarget)}
      onFocus={(e) => onHover(contractor.id, e.currentTarget)}
      className={`tone-${tone} group relative grid min-h-0 grid-cols-[1.2em_minmax(7.5rem,13.5rem)_minmax(0,1fr)_2.9em_56px_clamp(18px,2.7svh,24px)] items-center gap-x-[clamp(6px,0.6vw,12px)] rounded-[14px] px-[clamp(8px,0.8vw,14px)] transition-colors duration-200 hover:bg-fill-2 ${
        selected ? 'bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]' : ''
      }`}
    >
      <span className="num text-[clamp(13px,1.5svh,15px)] font-semibold text-faint">{rank}</span>
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="truncate text-[clamp(13px,1.6svh,16px)] font-semibold leading-tight tracking-[-0.015em]">
          <span data-handoff={CONTRACTOR_NAME}>{contractor.name}</span>
        </span>
        <span className="hidden shrink-0 text-[11px] text-faint min-[1500px]:inline">{contractor.subregion}</span>
      </span>
      <span className="relative h-[clamp(8px,1.15svh,13px)] rounded-full bg-fill-2" aria-hidden>
        {BAND_TICKS.map((t) => (
          <span key={t} className="absolute inset-y-0 w-[2px] -translate-x-1/2 bg-surface" style={{ left: `${t * 100}%` }} />
        ))}
        <motion.span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${Math.min(1, Math.max(0, total)) * 100}%`, background: 'var(--tone-dot)', transformOrigin: 'left' }}
          initial={reduce ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ type: 'tween', ease: EASE, duration: DUR, delay: delay + 0.1 }}
        />
      </span>
      <span className="figure text-right text-[clamp(16px,2.3svh,25px)]">
        <span data-handoff={CONTRACTOR_SCORE}>
          <CountUp value={total * 100} format={whole} delay={delay} />
          <span className="text-[0.5em] tracking-normal text-muted">%</span>
        </span>
      </span>
      <span className="flex justify-start" title={`Audit scores, oldest first: ${trendLabel(scores)}`}>
        <Sparkline values={scores} delay={delay + 0.2} />
      </span>
      <HandoffLink
        href={`/contractor/${contractor.id}${query}`}
        aria-label={`${contractor.name}, rank ${rank}, ${pct(total)}%, ${band}`}
        className="absolute inset-0 z-[1] rounded-[14px]"
      />
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`Compare ${contractor.name}`}
        disabled={disabled}
        onClick={onToggle}
        title={disabled ? 'Up to 3 contractors' : selected ? 'Remove from compare' : 'Add to compare'}
        className={`relative z-[2] grid size-[clamp(18px,2.7svh,24px)] place-items-center rounded-full transition-[background-color,transform,opacity] duration-200 active:scale-90 disabled:cursor-not-allowed disabled:opacity-30 ${
          selected
            ? 'text-[var(--accent)]'
            : 'text-faint hover:text-ink'
        }`}
      >
        {selected ? <Check size={14} strokeWidth={3} aria-hidden /> : <Plus size={14} strokeWidth={2.6} aria-hidden />}
      </button>
    </motion.li>
  );
}

/**
 * XL tile: contractors ranked by latest official score, highest first. Row → contractor details with the shared hand-off
 * (its name and score morph into the contractor page's title and score, lib/handoff);
 * the + toggle adds to compare (max 3; selection in ?c=, see lib/compare). Hosts the compare tray.
 */
export function ContractorsCard({ cards, compare }: { cards: Card[]; compare: Record<string, CompareEntry> }) {
  const reduce = useReducedMotion();
  const sp = useSearchParams();
  const pathname = usePathname();
  const ids = cards.map((c) => c.contractor.id);
  const selected = parseCompare(sp.get('c'), ids);
  const firstPaint = useRef(true);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    firstPaint.current = false;
    root.current?.setAttribute('data-hydrated', ''); // toggles are live (used by e2e)
  }, []);
  const setSelected = useCallback(
    (next: string[]) => window.history.replaceState(null, '', `${pathname}${withCompare(window.location.search, next)}`),
    [pathname],
  );
  const full = selected.length >= MAX_COMPARE;
  const [peek, setPeek] = useState<{ id: string; top: number; h: number } | null>(null);
  const onHover = useCallback((id: string | null, el?: HTMLElement) => {
    setPeek(id && el ? { id, top: el.offsetTop, h: el.offsetHeight } : null);
  }, []);
  const peekCard = peek ? cards.find((c) => c.contractor.id === peek.id) : undefined;
  // Carry an explicit filter into the details (the default overview URL stays clean).
  const query = sp.has('q') || sp.has('r') ? `?${new URLSearchParams([...sp].filter(([k]) => k === 'q' || k === 'r')).toString()}` : '';

  return (
    <>
    <motion.section
      ref={root}
      data-testid="contractors"
      aria-labelledby="contractors-title"
      initial={reduce ? false : RISE.initial}
      animate={RISE.animate}
      transition={calm(0.05)}
      onMouseLeave={() => onHover(null)}
      className="card relative flex min-h-0 min-w-0 flex-col px-[clamp(10px,1vw,18px)] pb-[clamp(8px,1.2svh,16px)] pt-[clamp(12px,1.8svh,24px)]"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-[clamp(8px,0.8vw,14px)] pb-[clamp(4px,1svh,12px)]">
        <div className="flex items-baseline gap-2.5">
          <h2 id="contractors-title" className="text-[clamp(20px,2.7svh,30px)] font-semibold tracking-[-0.03em]">
            Contractors
          </h2>
          <span className="num text-[clamp(15px,2svh,20px)] font-semibold text-faint">{cards.length}</span>
        </div>
        <TileLabel className="!font-normal">
          <span aria-live="polite">
            {selected.length === 0 ? '' : `${selected.length} of ${MAX_COMPARE} to compare`}
          </span>
        </TileLabel>
      </div>
      <ul className="grid min-h-0 flex-1 auto-rows-[minmax(44px,1fr)] min-[1200px]:auto-rows-[minmax(0,1fr)]">
        <AnimatePresence mode="popLayout" initial={!reduce}>
          {cards.map((card, i) => {
            const id = card.contractor.id;
            const on = selected.includes(id);
            return (
              <Row
                key={id}
                card={card}
                i={i}
                selected={on}
                disabled={!on && full}
                onToggle={() => setSelected(toggleCompare(selected, id))}
                animateIn={firstPaint.current}
                query={query}
                onHover={onHover}
              />
            );
          })}
        </AnimatePresence>
      </ul>
      <AnimatePresence>
        {peek && peekCard && <Peek key="peek" card={peekCard} top={peek.top} h={peek.h} />}
      </AnimatePresence>
    </motion.section>
    {/* Outside the tile: a transformed ancestor would trap the fixed sheet. Fixed boxes take no grid cell. */}
    <CompareTray
        entries={selected.map((id) => compare[id]).filter(Boolean)}
        candidates={cards.filter((c) => !selected.includes(c.contractor.id)).map((c) => ({ id: c.contractor.id, name: c.contractor.name }))}
        onAdd={(id) => setSelected(toggleCompare(selected, id))}
        onRemove={(id) => setSelected(selected.filter((x) => x !== id))}
        onClose={() => setSelected([])}
      />
    </>
  );
}
