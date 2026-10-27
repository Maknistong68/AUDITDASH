'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { BandBar } from '@/components/bento/BandsCard';
import { QuarterBar } from '@/components/charts/QuarterBar';
import { Signed } from '@/components/bento/parts';
import { HandoffLanding } from '@/components/motion/HandoffLink';
import { bandShort, bandTone, dateLabel, deltaPoints, pct, quarterLabel } from '@/lib/format';
import { BANDS_CARD, PORTFOLIO_CARD, PORTFOLIO_FIGURE, REGIONS_CARD } from '@/lib/handoff';
import { BANDS, bandFor } from '@/lib/scoring';
import { BAND_SLUGS, rowsInBand, type Trend } from '@/lib/timeline';
import type { Band, Quarter, Subregion } from '@/lib/types';

export interface AuditDot { id: string; date: string; score: number; band: Band; quarter: Quarter; x: number; href: string }
export interface AuditsRow { id: string; name: string; base: string; qual: string; href: string; latestBand: Band; audits: AuditDot[]; trends: Trend[] }
export interface QuarterValue { quarter: Quarter; value: number | null }
export interface RegionRow { region: Subregion; selected: boolean; byQuarter: QuarterValue[] }
export type Focus = 'bands' | 'regions';

/** Axis fraction → % of the plot's width (the quarter panels reach BLEED px past both ends, so no dot touches an edge). */
const at = (x: number) => x * 100;
const BLEED = 'clamp(12px,1.2vw,22px)';
const TREND: Record<Trend, string> = { up: 'var(--up)', down: 'var(--down)', flat: 'color-mix(in srgb, var(--muted) 55%, transparent)' };
const GREY = 'color-mix(in srgb, var(--muted) 40%, transparent)';
/** The latest of two values in the honest colour: green only when it rose, red when it fell (whole points). */
const latestHue = (prev: number | null, now: number | null) => {
  const d = now === null ? null : deltaPoints(now, prev);
  return d === null ? bandHue(now) : d > 0 ? 'var(--up)' : d < 0 ? 'var(--down)' : GREY;
};
/** A lone value (one quarter shown) in its band's colour. */
const bandHue = (v: number | null) => (v === null || !Number.isFinite(v) ? GREY : `var(--${bandTone(bandFor(v))}-dot)`);

/**
 * The /audits screen under the breadcrumb (Portfolio). Header strip (the landing of the Portfolio score card's hand-off):
 * the score with its band, Q4 → Q1 as two bars, the audit count. Main area: past audits on a time axis, one row per
 * contractor (worst latest score first), a band-coloured dot per audit with its score, joined by a line that is green
 * only when the score rose and red when it fell. Hover a dot for its date, score and band; a dot opens the audit's report,
 * a name the contractor. Side column: contractors by band (a click filters the rows, `band=`) and SR1 vs SR2 per quarter
 * (a click sets `r=`, as the filter bar does). `focus=bands|regions` rings that panel briefly.
 */
export function AuditsView(props: {
  avg: number | null;
  band: Band | null;
  auditCount: number;
  byQuarter: QuarterValue[];
  rows: AuditsRow[];
  axis: { quarters: { quarter: Quarter; from: number; to: number }[]; months: { x: number; from: number; to: number; month: number; label: string }[] };
  bands: Record<Band, number>;
  regions: RegionRow[];
  initialBand: Band | null;
  focus: Focus | null;
  empty: string | null;
}) {
  const { rows, bands, regions, empty } = props;
  const router = useRouter();
  const [band, setBand] = useState<Band | null>(props.initialBand);
  const [focus, setFocus] = useState<Focus | null>(props.focus);
  useEffect(() => {
    if (!props.focus) return;
    const t = setTimeout(() => setFocus(null), 3200);
    return () => clearTimeout(t);
  }, [props.focus]);

  const pickBand = (b: Band) => {
    const next = band === b ? null : b;
    setBand(next);
    const params = new URLSearchParams(window.location.search);
    params.delete('focus');
    if (next) params.set('band', BAND_SLUGS[next]);
    else params.delete('band');
    window.history.replaceState(null, '', `?${params}`);
  };
  const pickRegion = (r: Subregion) => {
    const selected = regions.filter((x) => x.selected).map((x) => x.region);
    const next = selected.length === 1 && selected[0] === r ? regions.map((x) => x.region) : [r];
    const params = new URLSearchParams(window.location.search);
    params.delete('focus');
    params.set('r', next.join(','));
    router.push(`/audits?${params}`, { scroll: false });
  };
  const shown = rowsInBand(rows, band);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[var(--gap-grid)] px-[var(--gutter)]">
      <HandoffLanding />
      <Header avg={props.avg} band={props.band} auditCount={props.auditCount} byQuarter={props.byQuarter} />
      {empty ? (
        <section data-testid="empty-state" className="card flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="figure text-[clamp(56px,10svh,112px)] text-faint" aria-hidden>0</p>
          <h2 className="text-[21px] font-semibold tracking-[-0.02em]">{empty}</h2>
        </section>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_clamp(280px,26vw,480px)] gap-[var(--gap-grid)]">
          <Timeline rows={shown} axis={props.axis} band={band} clear={() => band && pickBand(band)} />
          <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-[var(--gap-grid)]">
            <BandsPanel bands={bands} band={band} pick={pickBand} focused={focus === 'bands'} />
            <RegionsPanel regions={regions} pick={pickRegion} focused={focus === 'regions'} />
          </div>
        </div>
      )}
    </div>
  );
}

const PANEL = 'card flex min-h-0 flex-col px-[clamp(14px,1.4vw,26px)] py-[clamp(10px,1.6svh,22px)]';
const H2 = 'text-[clamp(13px,1.5svh,15px)] font-semibold tracking-[-0.01em]';

function Header({ avg, band, auditCount, byQuarter }: { avg: number | null; band: Band | null; auditCount: number; byQuarter: QuarterValue[] }) {
  const ok = avg !== null && Number.isFinite(avg);
  const [a, b] = byQuarter;
  const d = a && b && a.value !== null && b.value !== null ? deltaPoints(b.value, a.value) : null;
  return (
    <section
      data-testid="audits-header"
      className={`card grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-[clamp(28px,5vw,110px)] px-[clamp(16px,1.5vw,28px)] py-[clamp(10px,1.5svh,20px)] ${band ? `tone-${bandTone(band)}` : ''}`}
      style={{ viewTransitionName: PORTFOLIO_CARD }}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-[clamp(13px,1.5svh,16px)] font-semibold tracking-[-0.01em] text-muted">Portfolio score</h1>
        <div className="flex items-end gap-3">
          <p data-testid="audits-figure" className="figure text-[clamp(40px,6.2svh,76px)]" style={{ viewTransitionName: PORTFOLIO_FIGURE }}>
            {ok ? pct(avg) : <span className="text-faint">—</span>}
            {ok && <span className="ml-0.5 text-[0.46em] tracking-normal text-muted">%</span>}
          </p>
          {band && (
            <span data-testid="audits-band" className="badge mb-[0.45em] px-2 py-[2px] text-[13px]" title={band}>
              {bandShort(band)}
            </span>
          )}
        </div>
      </div>
      {byQuarter.length > 0 ? (
        <div
          data-testid="audits-quarters"
          role="img"
          aria-label={`Average score: ${byQuarter.map((q) => `${quarterLabel(q.quarter)} ${pct(q.value)}%`).join(', ')}`}
          className="grid max-w-[920px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5"
        >
          {byQuarter.map((q, k) => (
            <QuarterBar
              key={q.quarter}
              label={quarterLabel(q.quarter)}
              fraction={q.value}
              hue={k === byQuarter.length - 1 ? (byQuarter.length > 1 ? latestHue(byQuarter[0].value, q.value) : bandHue(q.value)) : GREY}
              delay={300 + k * 90}
              value={<Percent value={q.value} />}
              barTestid="audits-quarter-bar"
              valueTestid="audits-quarter-value"
            />
          ))}
          {d !== null && (
            <span data-testid="audits-delta" className="col-start-2 text-[12px] leading-none">
              <Signed d={d} />
            </span>
          )}
        </div>
      ) : (
        <div />
      )}
      <div className="flex items-end gap-2">
        <p data-testid="audits-count" className="figure text-[clamp(28px,4svh,46px)]">{auditCount}</p>
        <p className="pb-[0.35em] text-[13px] leading-tight text-muted">{auditCount === 1 ? 'audit' : 'audits'}</p>
      </div>
    </section>
  );
}

/** A 0–1 value as a whole percent with a small muted "%"; "—" without a value. */
function Percent({ value }: { value: number | null }) {
  return (
    <>
      {pct(value)}
      {value !== null && <span className="text-[0.7em] font-normal text-muted">%</span>}
    </>
  );
}

type Tip = { dot: AuditDot; left: number; top: number };

function Timeline({ rows, axis, band, clear }: {
  rows: AuditsRow[]; axis: { quarters: { quarter: Quarter; from: number; to: number }[]; months: { x: number; from: number; to: number; month: number; label: string }[] }; band: Band | null; clear: () => void;
}) {
  const card = useRef<HTMLElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const show = (dot: AuditDot, el: HTMLElement) => {
    const c = card.current?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (c) setTip({ dot, left: r.left + r.width / 2 - c.left, top: r.top - c.top });
  };
  const dots = rows.reduce((s, r) => s + r.audits.length, 0);
  return (
    <section
      ref={card}
      data-testid="audits-timeline"
      aria-labelledby="pa-title"
      className={`${PANEL} relative gap-[clamp(4px,0.9svh,12px)]`}
      onMouseLeave={() => setTip(null)}
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 id="pa-title" className={H2}>Past audits</h2>
          {band && (
            <button
              type="button"
              data-testid="band-chip"
              onClick={clear}
              aria-label={`${band} only. Show every band`}
              className={`tone-${bandTone(band)} inline-flex h-6 min-w-0 items-center gap-1.5 rounded-full bg-fill-2 pl-2 pr-1.5 text-[12px] font-semibold transition-colors hover:bg-fill`}
            >
              <span className="block size-[9px] shrink-0 rounded-full" style={{ background: 'var(--tone-dot)' }} aria-hidden />
              <span className="truncate">{bandShort(band)}</span>
              <X size={13} strokeWidth={2.6} className="shrink-0 text-muted" aria-hidden />
            </button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3 text-[11px] leading-none text-muted" aria-hidden>
          <span className="flex items-center gap-1"><span className="block h-[3px] w-4 rounded-full" style={{ background: TREND.up }} />up</span>
          <span className="flex items-center gap-1"><span className="block h-[3px] w-4 rounded-full" style={{ background: TREND.down }} />down</span>
        </div>
      </div>
      {rows.length === 0 ? (
        <div data-testid="empty-state" className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-center">
          <p className="figure text-[clamp(48px,8svh,96px)] text-faint" aria-hidden>0</p>
          <p className="text-[17px] font-semibold tracking-[-0.02em]">No contractors in this band</p>
        </div>
      ) : (
        <div
          role="list"
          aria-label={`${rows.length} contractors, ${dots} audits`}
          className="relative grid min-h-0 flex-1 grid-cols-[clamp(140px,22%,280px)_minmax(0,1fr)] gap-x-[calc(clamp(12px,1.2vw,22px)+10px)] pr-[clamp(12px,1.2vw,22px)]"
          style={{ gridTemplateRows: `auto repeat(${rows.length}, minmax(0, 1fr))` }}
        >
          {/* quarter columns behind the rows, a step of tone each (no rules); inside each quarter its middle month is one
              more faint step with hairline edges, so every month break reads (light · tinted · light) */}
          <div aria-hidden className="pointer-events-none relative col-start-2" style={{ gridRow: '1 / -1' }}>
            {axis.quarters.map((q, k) => (
              <div
                key={q.quarter}
                className="absolute inset-y-0 rounded-[12px] bg-fill-2"
                style={{
                  left: k === 0 ? `calc(-1 * ${BLEED})` : `calc(${at(q.from)}% + 3px)`,
                  right: k === axis.quarters.length - 1 ? `calc(-1 * ${BLEED})` : `calc(${100 - at(q.to)}% + 3px)`,
                }}
              />
            ))}
            {axis.months.filter((m) => m.month % 3 === 1).map((m) => (
              <div
                key={`${m.label}-${m.from}`}
                data-testid="audits-month-band"
                className="absolute inset-y-0 bg-fill-2 shadow-[inset_1px_0_0_var(--hairline),inset_-1px_0_0_var(--hairline)]"
                style={{ left: `${at(m.from)}%`, right: `${100 - at(m.to)}%` }}
              />
            ))}
          </div>
          <div aria-hidden className="relative col-start-2 row-start-1 h-[clamp(30px,4.2svh,44px)]">
            {axis.quarters.map((q) => (
              <span
                key={q.quarter}
                data-testid="audits-axis-quarter"
                className="absolute top-[clamp(4px,0.7svh,8px)] -translate-x-1/2 whitespace-nowrap text-[clamp(12px,1.5svh,14px)] font-semibold leading-none"
                style={{ left: `${at((q.from + q.to) / 2)}%` }}
              >
                {quarterLabel(q.quarter)}
              </span>
            ))}
            {axis.months.map((m) => (
              <span
                key={`${m.label}-${m.x}`}
                data-testid="audits-axis-month"
                className="absolute bottom-[2px] -translate-x-1/2 text-[11px] font-medium leading-none text-muted"
                style={{ left: `${at(m.x)}%` }}
              >
                {m.label}
              </span>
            ))}
          </div>
          {rows.map((r, i) => (
            <Row key={r.id} row={r} i={i} show={show} hide={() => setTip(null)} />
          ))}
        </div>
      )}
      {tip && (
        <div
          data-testid="audit-tooltip"
          role="tooltip"
          className={`tone-${bandTone(tip.dot.band)} pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-[calc(100%+10px)] flex-col items-center gap-1 whitespace-nowrap rounded-[12px] bg-surface px-3 py-2 shadow-[var(--shadow-lift)]`}
          style={{ left: tip.left, top: tip.top }}
        >
          <span className="num text-[12px] text-muted">{dateLabel(tip.dot.date)}</span>
          <span className="flex items-center gap-2">
            <span className="figure text-[22px]">
              {pct(tip.dot.score)}
              <span className="text-[0.55em] tracking-normal text-muted">%</span>
            </span>
            <span className="badge px-2 py-[2px] text-[12px]">{bandShort(tip.dot.band)}</span>
          </span>
        </div>
      )}
    </section>
  );
}

function Row({ row, i, show, hide }: { row: AuditsRow; i: number; show: (d: AuditDot, el: HTMLElement) => void; hide: () => void }) {
  const last = row.audits.at(-1)!;
  return (
    <div role="listitem" data-testid="audits-row" data-id={row.id} className="contents">
      <Link
        href={row.href}
        data-testid="audits-name"
        aria-label={`${row.name}: latest ${pct(last.score)}%. Open contractor`}
        className="col-start-1 flex min-h-0 min-w-0 items-center rounded-[10px] px-2 transition-colors hover:bg-fill-2"
        style={{ gridRow: i + 2 }}
      >
        <span className="flex min-w-0 items-baseline gap-1.5 leading-tight">
          <span className="truncate text-[clamp(12.5px,1.7svh,15px)] font-semibold tracking-[-0.01em]">{row.base}</span>
          {row.qual && <span className="truncate text-[11.5px] text-muted">{row.qual}</span>}
        </span>
      </Link>
      <div className="relative col-start-2 min-h-0" style={{ gridRow: i + 2 }}>
        <svg aria-hidden className="absolute inset-0 size-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
          {row.trends.map((t, k) => (
            <line
              key={k}
              data-testid="audit-line"
              data-trend={t}
              className="ps-line"
              x1={at(row.audits[k].x)}
              x2={at(row.audits[k + 1].x)}
              y1={58}
              y2={58}
              stroke={TREND[t]}
              strokeWidth={2.5}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              style={{ ['--d' as string]: `${500 + i * 40 + k * 120}ms` }}
            />
          ))}
        </svg>
        {row.audits.map((a, k) => (
          <Link
            key={a.id}
            href={a.href}
            data-testid="audit-dot"
            data-id={a.id}
            data-date={a.date}
            data-score={pct(a.score)}
            data-band={BAND_SLUGS[a.band]}
            aria-label={`${row.name}, ${dateLabel(a.date)}, ${pct(a.score)}%, ${a.band}. Open report`}
            onMouseEnter={(e) => show(a, e.currentTarget)}
            onFocus={(e) => show(a, e.currentTarget)}
            onBlur={hide}
            className={`tone-${bandTone(a.band)} group/dot absolute top-[58%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center`}
            style={{ left: `${at(a.x)}%` }}
          >
            <span
              className="num pointer-events-none absolute bottom-[calc(100%+3px)] text-[clamp(11px,1.45svh,13px)] font-semibold leading-none"
              aria-hidden
            >
              {pct(a.score)}
              <span className="text-[0.75em] font-normal">%</span>
            </span>
            <span
              className="rp-dot block size-[clamp(11px,1.5svh,15px)] rounded-full shadow-[0_0_0_2.5px_var(--surface)] transition-transform duration-200 group-hover/dot:scale-[1.35]"
              style={{ background: 'var(--tone-dot)', ['--d' as string]: `${350 + i * 40 + k * 120}ms` }}
            />
          </Link>
        ))}
      </div>
    </div>
  );
}

function BandsPanel({ bands, band, pick, focused }: { bands: Record<Band, number>; band: Band | null; pick: (b: Band) => void; focused: boolean }) {
  return (
    <section
      data-testid="audits-bands"
      data-focused={focused || undefined}
      aria-labelledby="pb-title"
      className={`${PANEL} gap-[clamp(6px,1.2svh,14px)] ${focused ? 'ps-focus' : ''}`}
      style={{ viewTransitionName: BANDS_CARD }}
    >
      <h2 id="pb-title" className={H2}>Contractors by band</h2>
      <BandBar bands={bands} className="h-[clamp(10px,1.4svh,14px)] shrink-0" />
      <ul className="flex min-h-0 flex-1 flex-col justify-between">
        {BANDS.map((b) => {
          const n = bands[b];
          const on = band === b;
          return (
            <li key={b} className="min-h-0">
              <button
                type="button"
                data-testid="band-filter"
                data-band={BAND_SLUGS[b]}
                data-count={n}
                disabled={n === 0}
                aria-pressed={on}
                aria-label={`${b}: ${n} contractors. ${on ? 'Show every band' : 'Show only these'}`}
                onClick={() => pick(b)}
                className={`tone-${bandTone(b)} grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 rounded-[10px] px-2 py-[clamp(2px,0.6svh,7px)] text-left transition-[background-color,opacity] duration-300 enabled:hover:bg-fill-2 disabled:cursor-default ${on ? 'bg-fill-2' : ''} ${band && !on ? 'opacity-45' : ''}`}
              >
                <span className="block size-[10px] rounded-full" style={{ background: 'var(--tone-dot)', opacity: n === 0 ? 0.35 : 1 }} aria-hidden />
                <span className={`text-[clamp(12.5px,1.7svh,15px)] leading-[1.15] ${n === 0 ? 'text-muted' : ''}`}>{bandShort(b)}</span>
                <span className={`num text-right text-[clamp(14px,1.9svh,17px)] font-semibold leading-none ${n === 0 ? 'text-faint' : ''}`}>{n}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RegionsPanel({ regions, pick, focused }: { regions: RegionRow[]; pick: (r: Subregion) => void; focused: boolean }) {
  const filtered = regions.some((r) => !r.selected);
  return (
    <section
      data-testid="audits-regions"
      data-focused={focused || undefined}
      aria-labelledby="pr-title"
      className={`${PANEL} gap-[clamp(6px,1.2svh,14px)] ${focused ? 'ps-focus' : ''}`}
      style={{ viewTransitionName: REGIONS_CARD }}
    >
      <h2 id="pr-title" className={H2}>Region · average score</h2>
      <ul className="flex min-h-0 flex-1 flex-col justify-around gap-[clamp(4px,1svh,12px)]">
        {regions.map((r) => {
          const [a, b] = r.byQuarter;
          const d = a && b && a.value !== null && b.value !== null ? deltaPoints(b.value, a.value) : null;
          const only = r.selected && filtered;
          return (
            <li key={r.region}>
              <button
                type="button"
                data-testid="region-filter"
                data-region={r.region}
                aria-pressed={only}
                aria-label={`${r.region}: ${r.byQuarter.map((q) => `${quarterLabel(q.quarter)} ${pct(q.value)}%`).join(', ')}. ${only ? 'Show both regions' : `Show ${r.region} only`}`}
                onClick={() => pick(r.region)}
                className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-[clamp(3px,0.6svh,6px)] rounded-[12px] px-2 py-[clamp(4px,0.8svh,8px)] text-left transition-[background-color,opacity] duration-300 hover:bg-fill-2 ${only ? 'bg-fill-2' : ''} ${r.selected ? '' : 'opacity-45'}`}
              >
                <span className="col-span-2 text-[clamp(13px,1.8svh,16px)] font-semibold">{r.region}</span>
                <span className="text-right text-[12px] leading-none">{d !== null && <Signed d={d} />}</span>
                {r.byQuarter.map((q, k) => (
                  <QuarterBar
                    key={q.quarter}
                    label={q.quarter.slice(0, 2)}
                    fraction={q.value}
                    hue={k === r.byQuarter.length - 1 ? (r.byQuarter.length > 1 ? latestHue(a.value, q.value) : bandHue(q.value)) : GREY}
                    delay={450 + k * 90}
                    value={<Percent value={q.value} />}
                    barTestid="region-quarter-bar"
                    valueTestid="region-quarter-value"
                  />
                ))}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
