'use client';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { SectionBars } from '@/components/charts/SectionBars';
import { CATEGORIES, categoryById } from '@/lib/categories';
import { bestWorst, MAX_COMPARE } from '@/lib/compare';
import { bandShort, bandTone, pct, prevQuarterShort } from '@/lib/format';
import { itemLabel } from '@/lib/itemLabels';
import type { ContractorCard as Card } from '@/lib/analytics';
import type { CategoryId } from '@/lib/types';
import { Delta } from '@/components/bento/ContractorsCard';

export interface CompareEntry {
  card: Card;
  gaps: { category: CategoryId; gapRate: number | null }[];
  repeatCount: number;
  topRepeats: { itemCode: string; question: string }[];
}

const SHEET = { type: 'spring', stiffness: 320, damping: 34, mass: 0.9 } as const;

/** Two-point trend: previous audit → latest, on a fixed 40–100% scale so columns compare honestly. */
function Trend({ card }: { card: Card }) {
  const { previous, total, auditId } = card;
  const y = (v: number) => 30 - ((Math.min(1, Math.max(0.4, v)) - 0.4) / 0.6) * 26;
  const vs = prevQuarterShort(auditId);
  if (previous === null) {
    return <p className="text-[13px] text-muted">First audit · no trend yet</p>;
  }
  const up = total >= previous;
  const color = Math.round(total * 100) === Math.round(previous * 100) ? 'var(--muted)' : up ? 'var(--up)' : 'var(--down)';
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 84 34" className="h-[34px] w-[84px] shrink-0 overflow-visible" aria-hidden>
        <line x1="6" x2="78" y1={y(previous)} y2={y(total)} strokeWidth="2.5" strokeLinecap="round" style={{ stroke: color }} />
        <rect x="2.5" y={y(previous) - 3.5} width="7" height="7" rx="3.5" style={{ fill: 'var(--surface)', stroke: color }} strokeWidth="2" />
        <rect x="74" y={y(total) - 4} width="8" height="8" rx="4" style={{ fill: color }} />
      </svg>
      <p className="num text-[13px] text-muted">
        {vs ?? 'Prev'} {pct(previous)} → <span className="font-semibold text-ink">{pct(total)}</span>
      </p>
    </div>
  );
}

const ROWS = `auto auto auto repeat(${CATEGORIES.length}, auto) auto auto auto auto`;

/**
 * Compare sheet: frosted, slides up when 2–3 contractors are selected. One CSS grid with subgrid columns,
 * so every row (score + A/B/C section bars, trend, the category gaps, repeat issues) lines up across contractors.
 * Gap bars use one severity hue; in each row the worst contractor is full strength, the best gets a check.
 */
export function CompareTray({
  entries,
  candidates,
  onAdd,
  onRemove,
  onClose,
}: {
  entries: CompareEntry[];
  candidates: { id: string; name: string }[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const open = entries.length >= 2;
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    ref.current?.setAttribute('data-keys', 'ready'); // hydrated: Esc now closes (used by e2e)
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // While open, pad the page by the sheet's height so the cards it covers can be scrolled into view.
  useEffect(() => {
    const el = ref.current;
    if (!open || !el) return;
    const ro = new ResizeObserver(() => {
      document.body.style.paddingBottom = `${el.offsetHeight}px`;
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.body.style.paddingBottom = '';
    };
  }, [open]);

  const gapRows = open
    ? entries[0].gaps.map((g, r) => ({ category: g.category, ...bestWorst(entries.map((e) => e.gaps[r]?.gapRate ?? null)) }))
    : [];
  const maxGap = Math.max(0.25, ...entries.flatMap((e) => e.gaps.map((g) => g.gapRate ?? 0)));
  const slots = entries.length < MAX_COMPARE && candidates.length > 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          ref={ref}
          key="tray"
          data-testid="compare-tray"
          role="region"
          aria-label="Compare contractors"
          initial={reduce ? false : { y: '104%' }}
          animate={{ y: 0 }}
          exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { y: '104%', transition: { type: 'spring', stiffness: 380, damping: 40 } }}
          transition={SHEET}
          className="glass sheet fixed inset-x-0 bottom-0 z-40 max-h-[calc(100svh-var(--topbar)-12px)] overflow-y-auto rounded-t-[28px] [box-shadow:var(--shadow-sheet)]"
        >
          <div className="mx-auto max-w-[1680px] px-[var(--gutter)] pb-[clamp(14px,2.4svh,28px)]">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 pb-2 pt-2.5">
              <span aria-hidden className="absolute left-1/2 top-2 h-[5px] w-9 -translate-x-1/2 rounded-full bg-fill" />
              <h2 className="pt-3 text-[clamp(18px,2.3svh,24px)] font-semibold tracking-[-0.025em]">Compare</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close compare"
                title="Close (Esc)"
                className="mt-3 grid size-8 place-items-center rounded-full bg-fill text-muted transition-[transform,color] hover:text-ink active:scale-90"
              >
                <X size={16} strokeWidth={2.6} aria-hidden />
              </button>
            </div>

            <div className="overflow-x-auto">
              <div
                className={`grid min-w-[720px] gap-x-[clamp(12px,1.4vw,24px)]`}
                style={{ gridTemplateRows: ROWS, gridTemplateColumns: `clamp(116px,10vw,170px) repeat(${entries.length}, minmax(0, 1fr))${slots ? ' minmax(150px, 0.55fr)' : ''}` }}
              >
                {/* Label column */}
                <div className="row-span-full grid grid-rows-subgrid text-[13px] text-muted">
                  <span />
                  <span className="self-center">Trend</span>
                  <span className="self-end pb-1 pt-[clamp(8px,1.6svh,16px)] font-semibold text-ink">Gap by category</span>
                  {gapRows.map((g) => (
                    <span key={g.category} className="flex items-center truncate" title={categoryById(g.category).name}>
                      {categoryById(g.category).short}
                    </span>
                  ))}
                  <span className="self-end pb-1 pt-[clamp(8px,1.6svh,16px)] font-semibold text-ink">Repeat issues</span>
                  <span />
                  <span />
                  <span />
                </div>

                <AnimatePresence initial={false} mode="popLayout">
                  {entries.map((e, ci) => (
                    <motion.div
                      key={e.card.contractor.id}
                      layout={reduce ? false : 'position'}
                      initial={reduce ? false : { opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      transition={SHEET}
                      data-testid="compare-column"
                      className="row-span-full grid min-w-0 grid-rows-subgrid"
                    >
                      <Header entry={e} onRemove={() => onRemove(e.card.contractor.id)} />
                      <div className="flex items-center border-b border-hairline py-[clamp(4px,0.9svh,10px)]">
                        <Trend card={e.card} />
                      </div>
                      <span />
                      {e.gaps.map((g, r) => (
                        <GapBar key={g.category} value={g.gapRate} max={maxGap} best={!!gapRows[r]?.best.includes(ci)} worst={!!gapRows[r]?.worst.includes(ci)} />
                      ))}
                      <p className="self-end pb-1 pt-[clamp(8px,1.6svh,16px)] text-[13px] text-muted">
                        {e.card.previous === null ? (
                          'No earlier audit to repeat'
                        ) : (
                          <>
                            <span className="num font-semibold text-ink">{e.repeatCount}</span> repeated {e.repeatCount === 1 ? 'item' : 'items'}
                          </>
                        )}
                      </p>
                      {[0, 1, 2].map((k) => {
                        const r = e.topRepeats[k];
                        return r ? (
                          <p key={k} data-testid="compare-repeat" className="flex min-w-0 items-baseline gap-2 py-[3px] text-[13px]" title={itemLabel(r.itemCode, r.question)}>
                            <span className="truncate">{itemLabel(r.itemCode, r.question)}</span>
                          </p>
                        ) : (
                          <span key={k} />
                        );
                      })}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {slots && (
                  <div className="row-span-full my-1 flex flex-col items-center justify-center gap-3 rounded-[18px] bg-fill-2 p-4 text-center">
                    <p className="text-[14px] text-muted">Add a third</p>
                    <select
                      aria-label="Add a contractor to compare"
                      value=""
                      onChange={(ev) => ev.target.value && onAdd(ev.target.value)}
                      className="h-9 max-w-full rounded-full bg-fill px-4 text-[14px] text-ink"
                    >
                      <option value="">Choose…</option>
                      {candidates.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

function Header({ entry, onRemove }: { entry: CompareEntry; onRemove: () => void }) {
  const { contractor, rings, total, band, previous, auditId, rank } = entry.card;
  return (
    <div className="flex min-w-0 flex-col gap-[clamp(6px,1svh,10px)] border-b border-hairline pb-[clamp(8px,1.4svh,14px)]">
      <div className="flex min-w-0 items-start gap-1.5">
        <span className="num pt-[2px] text-[13px] font-semibold text-faint">{rank}</span>
        <h3 className="line-clamp-2 text-[clamp(15px,1.9svh,19px)] font-semibold leading-tight tracking-[-0.02em]" title={contractor.name}>
          {contractor.name}
        </h3>
        <span className="mt-[2px] shrink-0 rounded-full bg-fill px-1.5 py-[1px] text-[12px] font-medium text-muted">{contractor.subregion}</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${contractor.name} from compare`}
          className="ml-auto grid size-6 shrink-0 place-items-center rounded-full text-faint hover:bg-fill hover:text-ink"
        >
          <X size={13} strokeWidth={2.6} aria-hidden />
        </button>
      </div>
      <div className="flex items-end gap-3">
        <p className="figure text-[clamp(32px,5svh,52px)]">
          {pct(total)}
          <span className="ml-0.5 text-[0.5em] tracking-normal text-muted">%</span>
        </p>
        <div className="flex flex-col items-start gap-1 pb-0.5">
          <span className={`badge tone-${bandTone(band)} px-2 py-[2px] text-[13px]`} title={band}>
            {bandShort(band)}
          </span>
          <Delta total={total} previous={previous} auditId={auditId} size={13} />
        </div>
      </div>
      <SectionBars rings={rings} delay={0.15} />
    </div>
  );
}

function GapBar({ value, max, best, worst }: { value: number | null; max: number; best: boolean; worst: boolean }) {
  const reduce = useReducedMotion();
  const ok = value !== null && Number.isFinite(value);
  const w = ok ? Math.max(0.015, value / max) : 0;
  return (
    <div data-testid="compare-gap" className="flex min-w-0 items-center gap-2.5 py-[clamp(2px,0.45svh,5px)]">
      <div className="relative h-[clamp(8px,1.1svh,11px)] flex-1 overflow-hidden rounded-full bg-fill-2">
        {ok && (
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${w * 100}%`, background: 'var(--gap)', opacity: worst ? 1 : 0.42, transformOrigin: 'left' }}
            initial={reduce ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ type: 'spring', stiffness: 140, damping: 22, delay: 0.2 }}
          />
        )}
      </div>
      <span
        className={`num w-[4.2ch] shrink-0 text-right text-[13px] ${worst ? 'font-semibold text-ink' : 'text-muted'}`}
        title={worst ? 'Largest gap in this row' : best ? 'Smallest gap in this row' : undefined}
      >
        {ok ? `${pct(value)}%` : '—'}
      </span>
      {/* "smallest of the row" is relative, not good in itself: neutral ink, never the green "good" tone */}
      <span className="grid w-3.5 shrink-0 place-items-center text-ink">
        {best && <Check size={14} strokeWidth={3} aria-label="Smallest gap" />}
      </span>
    </div>
  );
}
