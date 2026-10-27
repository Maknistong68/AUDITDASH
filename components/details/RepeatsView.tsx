'use client';
import Link from 'next/link';
import { Repeat2 } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { ReachBar, RepeatRule, RepeatStats } from '@/components/bento/RepeatsCard';
import { HandoffLanding } from '@/components/motion/HandoffLink';
import { REPEATS_CARD, REPEATS_FIGURE } from '@/lib/handoff';

export interface RepeatCol { id: string; name: string; base: string; qual: string; hits: number; href: string }
/** `step`: score lost in four steps (0 little … 3 most), null when the section was not scored (a neutral outlined dot). */
export interface RepeatCell { step: number | null; lost: number | null; href: string }
/** `times`: repeat findings on the question (a contractor with two follow-up audits can repeat it twice). */
export interface RepeatRow { key: string; label: string; reach: number; times: number; href: string; cells: (RepeatCell | null)[] }

/**
 * Dot by score lost in the contractor's latest audit repeating the question, two encodings: one warm hue, darker = more lost (tokens in
 * globals.css, every step >= 3:1 on the card in both themes), and larger = more lost.
 */
const TINT = ['var(--rp-0)', 'var(--rp-1)', 'var(--rp-2)', 'var(--rp-3)'];
const SIZE = ['58%', '72%', '86%', '100%'];
/** Smallest row (px) before the matrix falls back to "top N + more"; space between reach groups. */
const ROW_MIN = 16;
const GROUP_GAP = 6;

/**
 * The /repeats screen under the breadcrumb. Header strip (the landing of the dashboard card's hand-off): the figure,
 * the reach bar (questions per number of contractors repeating them) and what the count is made of. Then the questions ×
 * contractors matrix: widest reach first, a filled dot where the contractor noted the question again at its next audit
 * (darker and larger = more score lost there; outlined = not scored), a faint dot otherwise. The last column shows how
 * many times each question was repeated; a dot opens the item's history, a label the item in its category, a column head
 * the contractor. Rows share the height left; if they cannot all fit at ROW_MIN, the top N show with a "+M more" row that
 * expands in place inside the matrix's own scroll area. The page itself never scrolls.
 */
export function RepeatsView({ count, stats, spread, rows, cols, empty }: {
  /** Repeat findings; null when the filter has no follow-up audit. */
  count: number | null;
  stats: { questions: number; contractors: number; followUps: number };
  spread: { reach: number; of: number; questions: number }[];
  rows: RepeatRow[];
  cols: RepeatCol[];
  empty: string | null;
}) {
  return (
    <div className="tone-minimal flex min-h-0 flex-1 flex-col gap-[var(--gap-grid)] px-[var(--gutter)]">
      <HandoffLanding />
      <Header count={count} stats={stats} spread={spread} />
      {empty ? (
        <section data-testid="empty-state" className="card flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="figure text-[clamp(56px,10svh,112px)] text-faint" aria-hidden>{count === null ? '—' : '0'}</p>
          <h2 className="text-[21px] font-semibold tracking-[-0.02em]">{empty}</h2>
        </section>
      ) : (
        <Matrix rows={rows} cols={cols} />
      )}
    </div>
  );
}

function Header({ count, stats, spread }: {
  count: number | null; stats: { questions: number; contractors: number; followUps: number }; spread: { reach: number; of: number; questions: number }[];
}) {
  return (
    <section
      data-testid="repeats-header"
      className="card grid shrink-0 grid-cols-1 items-center gap-x-[clamp(20px,3vw,64px)] gap-y-3 px-[clamp(16px,1.5vw,28px)] py-[clamp(10px,1.5svh,20px)] min-[700px]:grid-cols-[auto_minmax(0,1fr)_auto]"
      style={{ viewTransitionName: REPEATS_CARD }}
    >
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-1.5 text-[clamp(13px,1.5svh,16px)] font-semibold tracking-[-0.01em]" style={{ color: 'var(--tone)' }}>
          <Repeat2 size={16} strokeWidth={2.4} aria-hidden />
          Repeat findings
        </h1>
        <div className="flex items-end gap-3">
          <p data-testid="repeats-figure" className="figure text-[clamp(40px,6.2svh,76px)]" style={{ viewTransitionName: REPEATS_FIGURE }}>
            {count === null ? <span className="text-faint">—</span> : count}
          </p>
          <p className="max-w-[24ch] pb-[0.5em] text-[13px] leading-tight text-muted">
            {count === null ? 'Needs a follow-up audit' : <RepeatRule />}
          </p>
        </div>
      </div>
      {/* phones: the reach bar (one labelled segment per reach) is wider than the screen; the stats say enough there */}
      <div className="min-w-0 max-[699px]:hidden">{count !== null && spread.length > 0 && <ReachBar spread={spread} />}</div>
      {count !== null ? <RepeatStats {...stats} /> : <div />}
    </section>
  );
}

function Matrix({ rows, cols }: { rows: RepeatRow[]; cols: RepeatCol[] }) {
  const body = useRef<HTMLDivElement>(null);
  // How many rows fit at ROW_MIN (null until measured: the server renders them all).
  const [fit, setFit] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const firstHidden = useRef<HTMLAnchorElement | null>(null);

  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    const measure = () => {
      const h = el.clientHeight;
      let used = 0;
      let n = 0;
      for (let i = 0; i < rows.length; i++) {
        used += ROW_MIN + (i > 0 && rows[i].reach !== rows[i - 1].reach ? GROUP_GAP : 0);
        if (used > h) break;
        n++;
      }
      // Not all fit: keep room for the "+M more" row.
      if (n < rows.length) {
        n = 0;
        used = ROW_MIN;
        for (let i = 0; i < rows.length; i++) {
          used += ROW_MIN + (i > 0 && rows[i].reach !== rows[i - 1].reach ? GROUP_GAP : 0);
          if (used > h) break;
          n++;
        }
      }
      setFit(n);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rows]);

  const clipped = !open && fit !== null && fit < rows.length;
  const shown = clipped ? rows.slice(0, fit) : rows;
  const cssCols = `clamp(220px, 19vw, 360px) repeat(${cols.length}, minmax(0, 1fr)) clamp(90px, 7vw, 130px)`;

  return (
    <section
      data-testid="repeats-matrix"
      role="table"
      aria-label="Repeating questions by contractor"
      aria-rowcount={rows.length + 1}
      className="card flex min-h-0 flex-1 flex-col px-[clamp(10px,1vw,20px)] py-[clamp(6px,1.2svh,16px)] max-[1199px]:overflow-x-auto"
    >
      {/* Below 1200px the page scrolls and the matrix keeps a readable width, scrolling sideways inside its card. */}
      <div role="row" aria-rowindex={1} className="grid shrink-0 items-end pb-[clamp(4px,0.8svh,10px)] max-[1199px]:min-w-[760px]" style={{ gridTemplateColumns: cssCols }}>
        <div role="columnheader" className="flex items-center gap-2 px-2 text-[11px] leading-none text-muted">
          <span className="sr-only">Question</span>
          <span aria-hidden data-testid="repeats-legend" className="flex items-center gap-1.5 whitespace-nowrap">
            score lost: low
            <span className="flex items-center gap-[3px]">
              {TINT.map((t, k) => (
                <span key={t} className="grid size-[11px] place-items-center">
                  <span className="block rounded-full" style={{ background: t, width: SIZE[k], height: SIZE[k] }} />
                </span>
              ))}
            </span>
            high
          </span>
        </div>
        {cols.map((c) => (
          <div role="columnheader" key={c.id} className="min-w-0">
            <Link
              href={c.href}
              data-testid="repeats-col"
              title={c.name}
              aria-label={`${c.name}: ${c.hits} of ${rows.length} repeating. Open contractor`}
              className="flex min-w-0 flex-col items-center rounded-lg px-1 py-0.5 text-center leading-tight transition-colors hover:bg-fill-2"
            >
              <span className="block max-w-full truncate text-[clamp(12px,1.5svh,14px)] font-semibold tracking-[-0.01em]">{c.base}</span>
              <span className="block max-w-full truncate text-[11px] text-muted">{c.qual || ' '}</span>
            </Link>
          </div>
        ))}
        <div role="columnheader" className="px-2 text-right text-[11px] leading-none text-muted">times repeated</div>
      </div>

      <div
        ref={body}
        role="rowgroup"
        data-testid="repeats-body"
        data-clipped={clipped ? '' : undefined}
        className={`flex min-h-0 flex-1 flex-col max-[1199px]:min-w-[760px] ${open ? 'overflow-y-auto overscroll-contain' : 'overflow-hidden'}`}
      >
        {shown.map((r, i) => (
          <Row
            key={r.key}
            row={r}
            index={i}
            rowIndex={rows.indexOf(r) + 2}
            cols={cols}
            cssCols={cssCols}
            gap={i > 0 && r.reach !== shown[i - 1].reach}
            open={open}
            labelRef={open && fit !== null && i === fit ? (el) => { firstHidden.current = el; } : undefined}
          />
        ))}
        {clipped && (
          <div role="row" className="grid shrink-0" style={{ gridTemplateColumns: cssCols, height: ROW_MIN + 4 }}>
            <div role="cell" className="col-span-full flex items-center">
              <button
                type="button"
                data-testid="repeats-more"
                onClick={() => {
                  setOpen(true);
                  requestAnimationFrame(() => firstHidden.current?.focus());
                }}
                className="rounded-full px-2 text-[12px] font-semibold text-[var(--accent)] transition-colors hover:bg-fill-2"
              >
                +{rows.length - shown.length} more
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Row({ row, index, rowIndex, cols, cssCols, gap, open, labelRef }: {
  row: RepeatRow; index: number; rowIndex: number; cols: RepeatCol[]; cssCols: string; gap: boolean; open: boolean;
  labelRef?: (el: HTMLAnchorElement | null) => void;
}) {
  return (
    <div
      role="row"
      aria-rowindex={rowIndex}
      data-testid="repeats-row"
      data-reach={row.reach}
      className="group/row grid min-h-0 items-center rounded-[8px] transition-colors hover:bg-fill-2 focus-within:bg-fill-2"
      style={{
        gridTemplateColumns: cssCols,
        flex: open ? `0 0 ${ROW_MIN + 6}px` : '1 1 0',
        minHeight: ROW_MIN,
        maxHeight: 34,
        marginTop: gap ? GROUP_GAP : 0,
      }}
    >
      <div role="rowheader" className="flex h-full min-w-0 items-center">
        <Link
          ref={labelRef}
          href={row.href}
          data-testid="repeats-label"
          className="block min-w-0 truncate rounded-md px-2 text-[clamp(12px,1.6svh,14.5px)] leading-[1.15] hover:underline"
        >
          {row.label}
        </Link>
      </div>
      {row.cells.map((c, k) =>
        c ? (
          <div role="cell" key={cols[k].id} className="h-full">
            <Link
              href={c.href}
              data-testid="repeats-cell"
              data-filled=""
              data-step={c.step ?? 'none'}
              aria-label={`${cols[k].name}: repeated, ${c.lost === null ? 'score not available' : `${c.lost}% score lost`}`}
              title={`${cols[k].name} · ${c.lost === null ? 'score not available' : `${c.lost}% score lost`}`}
              className="group/cell grid h-full place-items-center rounded-md"
            >
              <span className="grid size-[clamp(9px,1.35svh,15px)] place-items-center transition-transform duration-200 group-hover/cell:scale-[1.35] group-focus-visible/cell:scale-[1.35]">
                {c.step === null ? (
                  <span
                    data-testid="repeats-dot-unscored"
                    className="rp-dot block size-full rounded-full shadow-[inset_0_0_0_1.5px_var(--muted)]"
                    style={{ ['--d' as string]: `${220 + index * 16 + k * 22}ms` }}
                  />
                ) : (
                  <span
                    data-testid="repeats-dot"
                    className="rp-dot block rounded-full"
                    style={{ background: TINT[c.step], width: SIZE[c.step], height: SIZE[c.step], ['--d' as string]: `${220 + index * 16 + k * 22}ms` }}
                  />
                )}
              </span>
            </Link>
          </div>
        ) : (
          <div role="cell" key={cols[k].id} data-testid="repeats-cell" aria-label={`${cols[k].name}: not repeated`} className="grid h-full place-items-center">
            <span className="block size-[clamp(5px,0.7svh,7px)] rounded-full bg-[var(--fill)]" />
          </div>
        ),
      )}
      <div
        role="cell"
        data-testid="repeats-times"
        aria-label={`Repeated ${row.times} ${row.times === 1 ? 'time' : 'times'} at ${row.reach} ${row.reach === 1 ? 'contractor' : 'contractors'}`}
        className="num flex items-center justify-end gap-1 whitespace-nowrap px-2 text-[12px]"
      >
        <span className="font-semibold text-ink">{row.times}×</span>
      </div>
    </div>
  );
}
