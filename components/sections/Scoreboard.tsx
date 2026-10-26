'use client';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { RING_META } from '@/components/charts/ActivityRings';
import { MAX_COMPARE, parseCompare, toggleCompare, withCompare } from '@/lib/compare';
import type { ContractorCard as Card } from '@/lib/analytics';
import { ContractorCard } from './ContractorCard';
import { CompareTray, type CompareEntry } from './CompareTray';

const SPRING = { type: 'spring', stiffness: 220, damping: 26, mass: 0.9 } as const;

/** Legend: one tiny concentric glyph per ring, coloured, with its section name. */
function RingLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted" aria-label="Rings">
      {RING_META.map((m, i) => (
        <li key={m.key} className="flex items-center gap-1.5">
          <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
            {[7, 4.6, 2.2].map((r, k) => (
              <circle key={k} cx="8" cy="8" r={r} fill="none" strokeWidth="1.8" style={{ stroke: RING_META[k].color, opacity: k === i ? 1 : 0.2 }} />
            ))}
          </svg>
          <span>
            <span className="font-semibold text-ink">{m.key}</span> {m.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Contractor scoreboard: one card per contractor, ranked. Grid columns follow the card count (12 -> 6×2,
 * 8 -> 4×2) so two rows always fill the hero. Compare selection lives in `?c=` (replaceState, no reload).
 */
export function Scoreboard({ cards, compare }: { cards: Card[]; compare: Record<string, CompareEntry> }) {
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
    (next: string[]) => {
      window.history.replaceState(null, '', `${pathname}${withCompare(window.location.search, next)}`);
    },
    [pathname],
  );

  const cols = Math.min(6, Math.max(3, Math.ceil(cards.length / 2)));
  const full = selected.length >= MAX_COMPARE;

  return (
    <section ref={root} data-testid="scoreboard" aria-labelledby="board-title" className="flex min-h-0 flex-1 flex-col gap-[clamp(8px,1.4svh,16px)]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div className="flex items-baseline gap-2.5">
          <h2 id="board-title" className="text-[clamp(19px,2.4svh,26px)] font-semibold tracking-[-0.025em]">
            Contractors
          </h2>
          <span className="num text-[clamp(15px,1.9svh,19px)] font-semibold text-faint">{cards.length}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <RingLegend />
          <p className="text-[13px] text-muted" aria-live="polite">
            {selected.length === 0 ? 'Use + to compare up to 3' : `${selected.length} of ${MAX_COMPARE} selected`}
          </p>
        </div>
      </div>

      <div
        className="grid min-h-0 flex-1 gap-[var(--gap-grid)] max-[1199px]:!grid-cols-2 max-[1199px]:auto-rows-[300px] min-[1200px]:grid-rows-[repeat(2,minmax(0,1fr))] max-[640px]:!grid-cols-1"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        <AnimatePresence mode="popLayout" initial={!reduce}>
          {cards.map((card, i) => {
            const id = card.contractor.id;
            const on = selected.includes(id);
            return (
              <motion.div
                key={id}
                layout={reduce ? false : 'position'}
                initial={reduce ? false : { opacity: 0, y: 28, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.94, transition: { duration: 0.18 } }}
                transition={{ ...SPRING, delay: firstPaint.current ? 0.18 + i * 0.045 : 0 }}
                className="min-h-0 min-w-0"
              >
                <ContractorCard
                  card={card}
                  index={i}
                  selected={on}
                  disabled={!on && full}
                  onToggle={() => setSelected(toggleCompare(selected, id))}
                  animateIn={firstPaint.current}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <CompareTray
        entries={selected.map((id) => compare[id]).filter(Boolean)}
        candidates={cards.filter((c) => !selected.includes(c.contractor.id)).map((c) => ({ id: c.contractor.id, name: c.contractor.name }))}
        onAdd={(id) => setSelected(toggleCompare(selected, id))}
        onRemove={(id) => setSelected(selected.filter((x) => x !== id))}
        onClose={() => setSelected([])}
      />
    </section>
  );
}
