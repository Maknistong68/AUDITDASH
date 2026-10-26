'use client';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { usePathname, useSearchParams } from 'next/navigation';
import { ArrowDown, ArrowUp, Check, Plus } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { CountUp } from '@/components/motion/CountUp';
import { HandoffLink } from '@/components/motion/HandoffLink';
import { CompareTray, type CompareEntry } from '@/components/sections/CompareTray';
import { MAX_COMPARE, parseCompare, toggleCompare, withCompare } from '@/lib/compare';
import { CONTRACTOR_NAME, CONTRACTOR_SCORE } from '@/lib/handoff';
import { bandShort, bandTone, deltaPoints, pct, prevQuarterShort } from '@/lib/format';
import type { ContractorCard as Card } from '@/lib/analytics';
import { SPRING, TileLabel } from './BentoGrid';

const whole = (n: number) => String(Math.round(n));
const BAND_TICKS = [0.6, 0.7, 0.8, 0.9];

/** Δ in whole points vs the previous audit (computed from the displayed totals); nothing without a previous. */
export function Delta({ total, previous, auditId, size = 13, bare = false }: { total: number; previous: number | null; auditId: string; size?: number; bare?: boolean }) {
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
      {vs && !bare && <span className="ml-0.5 font-normal text-muted">vs {vs}</span>}
    </span>
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
}: {
  query: string;
  card: Card;
  i: number;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
  animateIn: boolean;
}) {
  const reduce = useReducedMotion();
  const { contractor, total, band, previous, rank, auditId } = card;
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
      data-score={total}
      className={`tone-${tone} group relative grid min-h-0 grid-cols-[1.6em_minmax(0,1.6fr)_minmax(0,1fr)_3.3em_6.4em_3.6em_24px] items-center gap-x-[clamp(8px,0.9vw,16px)] rounded-[14px] px-[clamp(8px,0.8vw,14px)] transition-colors duration-200 hover:bg-fill-2 ${
        selected ? 'bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]' : ''
      }`}
    >
      <span className="num text-[clamp(13px,1.5svh,15px)] font-semibold text-faint">{rank}</span>
      <span className="flex min-w-0 flex-col justify-center">
        <span className="truncate text-[clamp(14px,1.75svh,18px)] font-semibold leading-tight tracking-[-0.02em]" title={contractor.name}>
          <span data-handoff={CONTRACTOR_NAME}>{contractor.name}</span>
        </span>
        <span className="text-[12px] leading-tight text-muted">{contractor.subregion}</span>
      </span>
      <span className="relative h-[clamp(6px,0.9svh,9px)] rounded-full bg-fill-2" aria-hidden>
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
      <span className="flex justify-start">
        <Delta total={total} previous={previous} auditId={auditId} size={13} bare />
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
        className={`relative z-[2] grid size-[24px] place-items-center rounded-full transition-[background-color,transform,opacity] duration-200 active:scale-90 disabled:cursor-not-allowed disabled:opacity-30 ${
          selected
            ? 'bg-[var(--accent)] text-[var(--on-accent)]'
            : 'bg-fill-2 text-muted shadow-[inset_0_0_0_1.5px_var(--control)] hover:text-ink enabled:hover:bg-fill'
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
  // Carry an explicit filter into the details (the default overview URL stays clean).
  const query = sp.has('q') || sp.has('r') ? `?${new URLSearchParams([...sp].filter(([k]) => k === 'q' || k === 'r')).toString()}` : '';

  return (
    <>
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
          <span aria-live="polite">
            {selected.length === 0 ? 'Latest audit · Δ vs Q4 · + to compare' : `${selected.length} of ${MAX_COMPARE} selected to compare`}
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
              />
            );
          })}
        </AnimatePresence>
      </ul>
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
