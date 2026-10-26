'use client';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { TriangleAlert, X } from 'lucide-react';
import { useState } from 'react';
import { HandoffLanding } from '@/components/motion/HandoffLink';
import { HIGHRISK_CARD, HIGHRISK_FIGURE } from '@/lib/handoff';
import { rankHighRisk, type HazardId, type HighRiskContractor } from '@/lib/highRisk';
import type { Quarter } from '@/lib/types';

type Hazard = { hazard: HazardId; label: string; count: number; share: number };
type QuarterCount = { quarter: Quarter; count: number; audits: number };

const hue = (h: HazardId) => `var(--hz-${h})`;
const pct = (share: number) => `${Math.round(share * 100)}%`;
const qShort = (q: Quarter) => q.slice(0, 2);
const EASE = [0.22, 1, 0.36, 1] as const;

/** "Abyatona (Box Culvert H55)" → base "Abyatona", qualifier "Box Culvert H55". */
const split = (name: string) => {
  const m = /^(.*?)\s*\((.*)\)\s*$/.exec(name);
  return m ? { base: m[1], qual: m[2] } : { base: name, qual: '' };
};

/**
 * The /high-risk screen under the breadcrumb. Header strip (the landing of the dashboard card's hand-off): the figure and
 * Q4 → Q1 findings per audit with each quarter's total. Then two panels: findings by hazard type (donut + legend; a click
 * picks a hazard, again clears it, mirrored in `hz=`) and contractors ranked by findings per audit in their latest
 * quarter (bar = now, tick = the quarter before), recoloured and re-ranked for the picked hazard; a row opens the contractor.
 */
export function HighRiskView({ count, byQuarter, hazards, contractors, latest, initialHazard, empty }: {
  count: number;
  byQuarter: QuarterCount[];
  hazards: Hazard[];
  contractors: (HighRiskContractor & { href: string })[];
  /** The latest quarter in the filter (null without audits). */
  latest: Quarter | null;
  initialHazard: HazardId | null;
  empty: string | null;
}) {
  const [hz, setHz] = useState<HazardId | null>(initialHazard);
  const pick = (h: HazardId) => {
    const next = hz === h ? null : h;
    setHz(next);
    const params = new URLSearchParams(window.location.search);
    if (next) params.set('hz', next);
    else params.delete('hz');
    window.history.replaceState(null, '', `?${params}`);
  };
  return (
    <div className="tone-non flex min-h-0 flex-1 flex-col gap-[var(--gap-grid)] px-[var(--gutter)]">
      <HandoffLanding />
      <Header count={count} byQuarter={byQuarter} />
      {empty ? (
        <section data-testid="empty-state" className="card flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="figure text-[clamp(56px,10svh,112px)] text-faint" aria-hidden>0</p>
          <h2 className="text-[21px] font-semibold tracking-[-0.02em]">{empty}</h2>
        </section>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-[var(--gap-grid)]">
          <Hazards hazards={hazards} total={count} hz={hz} pick={pick} />
          <Contractors rows={contractors} hazard={hazards.find((h) => h.hazard === hz) ?? null} latest={latest} clear={() => hz && pick(hz)} />
        </div>
      )}
    </div>
  );
}

function Header({ count, byQuarter }: { count: number; byQuarter: QuarterCount[] }) {
  const reduce = useReducedMotion();
  const rates = byQuarter.map((q) => ({ ...q, rate: q.count / q.audits }));
  const max = Math.max(1e-9, ...rates.map((r) => r.rate));
  const [a, b] = rates;
  // As on the card: the latest bar is red when the rate rose, green when it fell.
  const last = !a || !b ? 'var(--tone-dot)' : b.rate > a.rate ? 'var(--down)' : b.rate < a.rate ? 'var(--up)' : 'var(--muted)';
  return (
    <section
      data-testid="highrisk-header"
      className="card grid shrink-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-[clamp(28px,5vw,110px)] px-[clamp(16px,1.5vw,28px)] py-[clamp(10px,1.5svh,20px)]"
      style={{ viewTransitionName: HIGHRISK_CARD }}
    >
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-1.5 text-[clamp(13px,1.5svh,16px)] font-semibold tracking-[-0.01em]" style={{ color: 'var(--tone)' }}>
          <TriangleAlert size={15} strokeWidth={2.4} aria-hidden />
          High-risk work
        </h1>
        <div className="flex items-end gap-3">
          <p data-testid="highrisk-figure" className="figure text-[clamp(40px,6.2svh,76px)]" style={{ viewTransitionName: HIGHRISK_FIGURE }}>
            {count}
          </p>
          <p className="pb-[0.5em] text-[13px] leading-tight text-muted">high-risk findings</p>
        </div>
      </div>
      {rates.length > 0 ? (
        <div
          data-testid="highrisk-quarters"
          role="img"
          aria-label={`Findings per audit: ${rates.map((r) => `${r.quarter.replace('-', ' ')} ${r.rate.toFixed(1)} (${r.count} in ${r.audits} audits)`).join(', ')}`}
          className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1.5"
        >
          <span />
          <span />
          <span className="text-right text-[11px] leading-none text-muted">per audit</span>
          <span className="text-right text-[11px] leading-none text-muted">total</span>
          {rates.map((q, k) => (
            <QuarterRow
              key={q.quarter}
              q={q}
              max={max}
              bg={k === rates.length - 1 ? last : 'color-mix(in srgb, var(--muted) 40%, transparent)'}
              delay={0.3 + k * 0.09}
              reduce={!!reduce}
            />
          ))}
        </div>
      ) : (
        <div />
      )}
    </section>
  );
}

function QuarterRow({ q, max, bg, delay, reduce }: { q: QuarterCount & { rate: number }; max: number; bg: string; delay: number; reduce: boolean }) {
  return (
    <>
      <span className="num text-[12px] leading-none text-muted">{q.quarter.replace('-', ' ')}</span>
      <span className="block h-[clamp(10px,1.4svh,14px)] rounded-full bg-fill-2">
        <motion.span
          data-testid="highrisk-quarter-bar"
          className="block h-full rounded-full"
          style={{ width: `${(q.rate / max) * 100}%`, background: bg, transformOrigin: 'left' }}
          initial={reduce ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.9, ease: EASE, delay }}
        />
      </span>
      <span data-testid="highrisk-quarter-rate" className="num text-right text-[clamp(15px,2svh,20px)] font-semibold leading-none">{q.rate.toFixed(1)}</span>
      <span data-testid="highrisk-quarter-total" className="num min-w-[3ch] text-right text-[12px] leading-none text-muted">{q.count}</span>
    </>
  );
}

/** Donut geometry (viewBox 0 0 100 100). */
const R = 38;
const STROKE = 17;
const point = (deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return `${(50 + R * Math.cos(a)).toFixed(3)} ${(50 + R * Math.sin(a)).toFixed(3)}`;
};
const arc = (from: number, to: number) => `M ${point(from)} A ${R} ${R} 0 ${to - from > 180 ? 1 : 0} 1 ${point(to)}`;

function Hazards({ hazards, total, hz, pick }: { hazards: Hazard[]; total: number; hz: HazardId | null; pick: (h: HazardId) => void }) {
  const reduce = useReducedMotion();
  const shown = hazards.filter((h) => h.count > 0).sort((a, b) => b.count - a.count || (a.hazard === 'other' ? 1 : b.hazard === 'other' ? -1 : 0));
  const picked = hazards.find((h) => h.hazard === hz) ?? null;
  const gap = shown.length > 1 ? 1.4 : 0;
  let at = 0;
  const segs = shown.map((h) => {
    const sweep = Math.min(359.99, h.share * 360);
    const s = { h, from: at + gap / 2, to: at + Math.max(gap / 2 + 0.3, sweep - gap / 2) };
    at += sweep;
    return s;
  });
  return (
    <section data-testid="highrisk-hazards" aria-labelledby="hz-title" className="card flex min-h-0 flex-col gap-[clamp(6px,1.2svh,16px)] px-[clamp(14px,1.4vw,26px)] py-[clamp(10px,1.6svh,22px)]">
      <h2 id="hz-title" className="text-[clamp(13px,1.5svh,15px)] font-semibold tracking-[-0.01em]">By hazard</h2>
      {/* Side by side on short screens; on tall ones (the panel is tall) the donut sits over its legend. */}
      <div className="flex min-h-0 flex-1 items-center justify-center gap-[clamp(14px,2vw,40px)] [@media(min-height:900px)]:flex-col">
        <div className="relative aspect-square h-full max-h-[340px] min-h-0 max-w-[46%] shrink-0 [@media(min-height:900px)]:h-auto [@media(min-height:900px)]:max-h-none [@media(min-height:900px)]:w-[min(100%,36svh)] [@media(min-height:900px)]:max-w-none">
          <svg viewBox="0 0 100 100" className="block size-full" aria-hidden>
            <circle cx="50" cy="50" r={R} fill="none" stroke="var(--fill-2)" strokeWidth={STROKE} />
            {segs.map(({ h, from, to }, k) => (
              <motion.path
                key={h.hazard}
                data-testid="hazard-segment"
                data-hazard={h.hazard}
                d={arc(from, to)}
                fill="none"
                stroke={hue(h.hazard)}
                strokeWidth={hz === h.hazard ? STROKE + 3 : STROKE}
                className="cursor-pointer transition-[opacity,stroke-width] duration-300"
                style={{ opacity: hz && hz !== h.hazard ? 0.22 : 1 }}
                initial={reduce ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.7, ease: EASE, delay: 0.35 + k * 0.09 }}
                onClick={() => pick(h.hazard)}
              />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span data-testid="hazard-center" className="figure text-[clamp(26px,4.4svh,48px)]">{picked ? picked.count : total}</span>
            <span className="max-w-[60%] truncate text-[clamp(11px,1.4svh,13px)] leading-tight text-muted">{picked ? pct(picked.share) : 'all hazards'}</span>
          </div>
        </div>
        <ul className="flex min-w-0 flex-1 flex-col justify-center gap-[clamp(2px,0.4svh,6px)] [@media(min-height:900px)]:w-full [@media(min-height:900px)]:max-w-[440px] [@media(min-height:900px)]:flex-none">
          {shown.map((h) => {
            const on = hz === h.hazard;
            return (
              <li key={h.hazard}>
                <button
                  type="button"
                  data-testid="hazard"
                  data-hazard={h.hazard}
                  data-count={h.count}
                  aria-pressed={on}
                  aria-label={`${h.label}: ${h.count} findings, ${pct(h.share)}. ${on ? 'Show all hazards' : 'Show contractors for this hazard'}`}
                  onClick={() => pick(h.hazard)}
                  className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto_3.2em] items-center gap-x-2.5 rounded-[10px] px-2 py-[clamp(3px,0.7svh,8px)] text-left transition-[background-color,opacity] duration-300 hover:bg-fill-2 ${on ? 'bg-fill-2' : ''} ${hz && !on ? 'opacity-45' : ''}`}
                >
                  <span className="block size-[11px] rounded-full" style={{ background: hue(h.hazard) }} aria-hidden />
                  <span className="text-[clamp(12.5px,1.7svh,15px)] leading-[1.15]">{h.label}</span>
                  <span className="num text-right text-[clamp(13px,1.8svh,16px)] font-semibold leading-none">{h.count}</span>
                  <span className="num text-right text-[12px] leading-none text-muted">{pct(h.share)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Contractors({ rows, hazard, latest, clear }: {
  rows: (HighRiskContractor & { href: string })[]; hazard: Hazard | null; latest: Quarter | null; clear: () => void;
}) {
  const ranked = rankHighRisk(rows, hazard?.hazard ?? null);
  const hrefOf = new Map(rows.map((r) => [r.id, r.href]));
  const max = Math.max(1e-9, ...ranked.flatMap((r) => [r.now, r.past ?? 0]));
  const fill = hazard ? hue(hazard.hazard) : 'var(--tone)';
  const twoQuarters = ranked.some((r) => r.past !== null);
  return (
    <section data-testid="highrisk-contractors" aria-labelledby="hc-title" className="card flex min-h-0 flex-col gap-[clamp(4px,0.9svh,12px)] px-[clamp(14px,1.4vw,26px)] py-[clamp(10px,1.6svh,22px)]">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 id="hc-title" className="text-[clamp(13px,1.5svh,15px)] font-semibold tracking-[-0.01em]">By contractor</h2>
          {hazard && (
            <button
              type="button"
              data-testid="hazard-chip"
              onClick={clear}
              aria-label={`${hazard.label} only. Show all hazards`}
              className="inline-flex h-6 min-w-0 items-center gap-1.5 rounded-full bg-fill-2 pl-2 pr-1.5 text-[12px] font-semibold transition-colors hover:bg-fill"
            >
              <span className="block size-[9px] shrink-0 rounded-full" style={{ background: hue(hazard.hazard) }} aria-hidden />
              <span className="truncate">{hazard.label}</span>
              <X size={13} strokeWidth={2.6} className="shrink-0 text-muted" aria-hidden />
            </button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3 text-[11px] leading-none text-muted" aria-hidden>
          <span>per audit</span>
          {latest && (
            <span className="flex items-center gap-1">
              <span className="block h-[8px] w-3.5 rounded-full" style={{ background: fill }} />
              {qShort(latest)}
            </span>
          )}
          {twoQuarters && (
            <span className="flex items-center gap-1">
              <span className="block h-3 w-[3px] rounded-full bg-[var(--text)]" />
              Q4
            </span>
          )}
        </div>
      </div>
      <ol className="flex min-h-0 flex-1 flex-col">
        {ranked.map((r, i) => {
          const { base, qual } = split(r.name);
          const current = r.nowQuarter === latest;
          return (
            <motion.li key={r.id} layout transition={{ duration: 0.5, ease: EASE }} className="flex min-h-[20px] flex-[1_1_0] [max-height:64px]">
              <Link
                href={hrefOf.get(r.id)!}
                data-testid="highrisk-contractor"
                data-id={r.id}
                data-now={r.now.toFixed(2)}
                aria-label={`${r.name}: ${r.now.toFixed(1)} high-risk findings per audit in ${r.nowQuarter.replace('-', ' ')}${r.past === null ? '' : `, ${r.past.toFixed(1)} in the quarter before`}. Open contractor`}
                className="group/row grid w-full grid-cols-[clamp(150px,24%,300px)_minmax(0,1fr)_clamp(78px,7vw,110px)] items-center gap-x-3 rounded-[10px] px-2 transition-colors hover:bg-fill-2"
              >
                <span className="flex min-w-0 items-baseline gap-1.5 leading-tight">
                  <span className="truncate text-[clamp(12.5px,1.7svh,15px)] font-semibold tracking-[-0.01em]">{base}</span>
                  {qual && <span className="truncate text-[11.5px] text-muted">{qual}</span>}
                </span>
                <span className="relative block h-[clamp(9px,1.5svh,16px)] rounded-full bg-fill-2">
                  <span
                    data-testid="highrisk-contractor-bar"
                    className="hr-grow block h-full rounded-full transition-[width,background-color] duration-500"
                    style={{
                      width: `${(r.now / max) * 100}%`,
                      background: current ? fill : 'color-mix(in srgb, var(--muted) 40%, transparent)',
                      ['--d' as string]: `${300 + i * 45}ms`,
                    }}
                  />
                  {r.past !== null && (
                    <span
                      data-testid="highrisk-contractor-past"
                      className="absolute -inset-y-[3px] w-[3px] -translate-x-1/2 rounded-full bg-[var(--text)] shadow-[0_0_0_1.5px_var(--surface)] transition-[left] duration-500"
                      style={{ left: `${(r.past / max) * 100}%` }}
                    />
                  )}
                </span>
                <span className="num flex items-baseline justify-end gap-1 whitespace-nowrap leading-none">
                  {r.past !== null && <span className="text-[12px] text-muted">{r.past.toFixed(1)} →</span>}
                  <span data-testid="highrisk-contractor-rate" className="text-[clamp(13px,1.8svh,16px)] font-semibold">{r.now.toFixed(1)}</span>
                  {!current && <span className="text-[11px] text-muted">{qShort(r.nowQuarter)}</span>}
                </span>
              </Link>
            </motion.li>
          );
        })}
      </ol>
    </section>
  );
}
