'use client';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { RepeatStats } from '@/components/bento/RepeatsCard';
import { HandoffLanding } from '@/components/motion/HandoffLink';
import { REPEATS_CARD, REPEATS_FIGURE } from '@/lib/handoff';

export interface HeatCol { id: string; name: string; base: string; qual: string; total: number; href: string }
/** `n`: times the contractor repeated the question (consecutive audit pairs); 0 = not repeated (blank cell). */
export interface HeatCell { n: number; href: string }
export interface HeatRow { key: string; label: string; total: number; href: string; cells: HeatCell[] }
export interface HeatGroup { id: string; name: string; rows: HeatRow[] }

/** Fill step by times repeated: 1, 2, 3, 4+ (tokens in globals.css; every step >= 3:1 on the card in both themes). */
const step = (n: number) => Math.min(4, n);
const times = (n: number) => `repeated ${n}×`;

/**
 * The /repeats screen under the breadcrumb. Header strip (the landing of the dashboard card's hand-off): the total
 * repeats, what they are made of and the fill key. Then an Excel-style heat map: questions (grouped by category under
 * thin header rows) × contractors, each cell the times repeated (blank when 0), filled on a warm ramp by count, with a
 * row total column and a column total row. When the rows do not fit, the grid scrolls inside its own card with a sticky
 * header row, label column and totals row; the page itself never scrolls.
 */
export function RepeatsView({ count, stats, groups, cols, empty }: {
  /** Total repeats; null when the filter has no follow-up audit. */
  count: number | null;
  stats: { questions: number; contractors: number };
  groups: HeatGroup[];
  cols: HeatCol[];
  empty: string | null;
}) {
  return (
    <div className="tone-minimal flex min-h-0 flex-1 flex-col gap-[var(--gap-grid)] px-[var(--gutter)]">
      <HandoffLanding />
      <Header count={count} stats={stats} multi={groups.some((g) => g.rows.some((r) => r.cells.some((c) => c.n > 1)))} />
      {empty ? (
        <section data-testid="empty-state" className="card flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="figure text-[clamp(56px,10svh,112px)] text-faint" aria-hidden>{count === null ? '—' : '0'}</p>
          <h2 className="text-[21px] font-semibold tracking-[-0.02em]">{empty}</h2>
        </section>
      ) : (
        <HeatMap groups={groups} cols={cols} total={count ?? 0} />
      )}
    </div>
  );
}

function Header({ count, stats, multi }: { count: number | null; stats: { questions: number; contractors: number }; multi: boolean }) {
  return (
    <section
      data-testid="repeats-header"
      className="card grid shrink-0 grid-cols-1 items-end gap-x-[clamp(20px,3vw,64px)] gap-y-3 px-[clamp(16px,1.5vw,28px)] py-[clamp(10px,1.5svh,20px)] min-[700px]:grid-cols-[auto_minmax(0,1fr)_auto]"
      style={{ viewTransitionName: REPEATS_CARD }}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-[clamp(13px,1.5svh,16px)] font-semibold tracking-[-0.01em] text-muted">
          Repeat findings
        </h1>
        <div data-testid="repeats-total" className="flex items-baseline gap-2.5">
          <p data-testid="repeats-figure" className="figure text-[clamp(40px,6.2svh,76px)]" style={{ viewTransitionName: REPEATS_FIGURE }}>
            {count === null ? <span className="text-faint">—</span> : count}
          </p>{' '}
          {count !== null && <span className="text-[clamp(17px,2.2svh,22px)] font-semibold tracking-[-0.02em]">{count === 1 ? 'repeat' : 'repeats'}</span>}
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 pb-[0.35em]">
        {count === null && <p className="text-[13px] leading-tight text-muted">—</p>}
        {count !== null && <RepeatStats {...stats} />}
      </div>
      {/* The colour key only when a question repeated more than once: with every cell at 1 it says nothing. */}
      {count !== null && multi ? <Legend /> : <div />}
    </section>
  );
}

/** The fill key: one swatch per step, its count printed in it (the ink the cells use). */
function Legend() {
  return (
    <div data-testid="repeats-legend" aria-hidden className="flex items-center gap-2 pb-[0.35em] text-[12px] text-muted max-[699px]:hidden">
      times repeated
      <span className="flex gap-[3px]">
        {[1, 2, 3, 4].map((k) => (
          <span
            key={k}
            className="num grid h-[22px] w-[30px] place-items-center rounded-[3px] text-[12px] font-semibold"
            style={{ background: `var(--heat-${k})`, color: `var(--heat-on-${k})` }}
          >
            {k === 4 ? '4+' : k}
          </span>
        ))}
      </span>
    </div>
  );
}

type Tip = { text: string; x: number; y: number; below: boolean } | null;

function HeatMap({ groups, cols, total }: { groups: HeatGroup[]; cols: HeatCol[]; total: number }) {
  const [tip, setTip] = useState<Tip>(null);
  const [hot, setHot] = useState<{ row: string; col: number } | null>(null);
  const show = useCallback((el: HTMLElement, text: string, row: string, col: number) => {
    const r = el.getBoundingClientRect();
    const below = r.top < 90;
    setTip({ text, x: r.left + r.width / 2, y: below ? r.bottom + 8 : r.top - 8, below });
    setHot({ row, col });
  }, []);
  const hide = useCallback(() => { setTip(null); setHot(null); }, []);
  let index = 0;

  return (
    <section data-testid="repeats-heatmap" aria-label="Times each question was repeated, by contractor" className="card flex min-h-0 flex-1 flex-col overflow-hidden p-[clamp(6px,0.8vw,12px)]">
      <div data-testid="heat-scroll" onScroll={hide} className="min-h-0 flex-1 overflow-auto overscroll-contain rounded-[10px]">
        <table className="heat w-full min-w-[820px] table-fixed border-separate border-spacing-0 text-[clamp(12px,1.45svh,14px)]">
          <caption className="sr-only">Times each question was repeated at the contractor&apos;s next audit, with totals</caption>
          <colgroup>
            <col style={{ width: 'clamp(220px, 22vw, 440px)' }} />
            {cols.map((c) => <col key={c.id} />)}
            <col style={{ width: 'clamp(60px, 4.6vw, 84px)' }} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="heat-head heat-corner px-2 text-left align-bottom text-[12px] font-normal text-muted">Question</th>
              {cols.map((c, k) => (
                <th key={c.id} scope="col" className="heat-head p-0 align-bottom font-normal" data-hot={hot?.col === k ? '' : undefined}>
                  <Link
                    href={c.href}
                    data-testid="heat-col"
                    title={c.name}
                    aria-label={`${c.name}: ${c.total} ${c.total === 1 ? 'repeat' : 'repeats'}. Open contractor`}
                    className="heat-col-link flex min-w-0 flex-col items-center rounded-[6px] px-1 pb-1.5 pt-1 text-center leading-tight transition-colors hover:bg-fill-2"
                  >
                    <span className="block max-w-full truncate text-[clamp(12px,1.5svh,14px)] font-semibold tracking-[-0.01em] text-ink">{c.base}</span>
                    <span className="block max-w-full truncate text-[11px] text-muted">{c.qual || ' '}</span>
                  </Link>
                </th>
              ))}
              <th scope="col" className="heat-head px-2 pb-1.5 text-right align-bottom text-[12px] font-normal text-muted">Total</th>
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.id} data-testid="heat-group-body">
              <tr data-testid="heat-group">
                <th scope="colgroup" colSpan={cols.length + 2} className="heat-group px-2 text-left text-[11.5px] font-semibold text-muted">
                  <span className="heat-sticky-label">{g.name}</span>
                </th>
              </tr>
              {g.rows.map((r) => {
                const i = index++;
                return (
                  <tr key={r.key} data-testid="heat-row" className="heat-row" data-hot={hot?.row === r.key ? '' : undefined}>
                    <th scope="row" className="heat-label-cell p-0 text-left font-normal">
                      <Link href={r.href} data-testid="heat-label" title={r.label} className="heat-label block truncate rounded-[6px] px-2 hover:underline">
                        {r.label}
                      </Link>
                    </th>
                    {r.cells.map((c, k) => {
                      const col = cols[k];
                      const text = `${col.name} · ${r.label}: ${c.n ? times(c.n) : 'not repeated'}`;
                      const delay = { ['--d' as string]: `${Math.min(900, 160 + i * 10 + k * 18)}ms` };
                      return (
                        <td
                          key={col.id}
                          data-testid="heat-cell"
                          data-n={c.n}
                          className="heat-td p-[1.5px]"
                          onMouseEnter={(e) => show(e.currentTarget, text, r.key, k)}
                          onMouseLeave={hide}
                        >
                          {c.n > 0 ? (
                            <Link
                              href={c.href}
                              aria-label={text}
                              onFocus={(e) => show(e.currentTarget, text, r.key, k)}
                              onBlur={hide}
                              className="heat-fill rp-dot num grid place-items-center rounded-[3px] font-semibold"
                              style={{ background: `var(--heat-${step(c.n)})`, color: `var(--heat-on-${step(c.n)})`, ...delay }}
                            >
                              {c.n}
                            </Link>
                          ) : (
                            <span className="heat-fill heat-empty block rounded-[3px]" />
                          )}
                        </td>
                      );
                    })}
                    <td data-testid="heat-row-total" className="num px-2 text-right font-semibold">{r.total}</td>
                  </tr>
                );
              })}
            </tbody>
          ))}
          <tfoot>
            <tr>
              <th scope="row" className="heat-foot heat-corner-foot px-2 text-left text-[12px] font-normal text-muted">Total</th>
              {cols.map((c, k) => (
                <td key={c.id} data-testid="heat-col-total" className="heat-foot num text-center font-semibold" data-hot={hot?.col === k ? '' : undefined}>
                  {c.total}
                </td>
              ))}
              <td data-testid="heat-total" className="heat-foot num px-2 text-right font-semibold">{total}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {tip && (
        <div
          data-testid="heat-tooltip"
          role="tooltip"
          className="pointer-events-none fixed z-50 max-w-[360px] rounded-[8px] bg-[var(--raised)] px-2.5 py-1.5 text-[12.5px] leading-snug text-ink shadow-[var(--shadow-lift)]"
          style={{ left: tip.x, top: tip.y, transform: `translate(-50%, ${tip.below ? '0' : '-100%'})` }}
        >
          {tip.text}
        </div>
      )}
    </section>
  );
}
