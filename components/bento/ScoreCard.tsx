'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { CountUp } from '@/components/motion/CountUp';
import Link from 'next/link';
import { BANDS } from '@/lib/scoring';
import { bandColor, bandShort, bandTone, int, pct } from '@/lib/format';
import { calm } from '@/lib/motion';
import type { Band } from '@/lib/types';
import { BentoCard, TileLabel } from './BentoGrid';
import { BIG, CardChevron, PAD, Signed, whole } from './parts';

export interface PortfolioInsight {
  best: { name: string; score: number } | null;
  worst: { name: string; score: number } | null;
  regions: { region: string; score: number | null }[];
  /** Audits whose typed Excel total differs from the score computed from their own points. */
  excel: { audits: number; differs: number; meanGap: number | null };
}

/**
 * M: the portfolio score (average honest score over the filtered audits), its band, the change against the previous
 * quarter when one quarter is selected, and the contractors per band as one segmented bar. Hover: best and worst
 * contractor, the two regions, and the Excel check (how many typed totals differ from their own points). Opens the
 * audits log.
 */
export function ScoreCard({ avgScore, band, audits, delta, bands, insight, href }: {
  avgScore: number | null; band: Band | null; audits: number; delta: number | null;
  bands: Record<Band, number>; insight: PortfolioInsight; href: string;
}) {
  const reduce = useReducedMotion();
  const ok = avgScore !== null && Number.isFinite(avgScore);
  const total = BANDS.reduce((s, b) => s + bands[b], 0);
  const shown = BANDS.filter((b) => bands[b] > 0);
  return (
    <BentoCard i={3} testid="kpi-score" className={`${PAD} lift reveal-host group gap-2 min-[640px]:col-span-3 ${band ? `tone-${bandTone(band)}` : ''}`}>
      <Link
        href={href}
        aria-label={`Portfolio score: ${ok ? `${pct(avgScore)}%` : 'no score'}. Open the audits log`}
        className="absolute inset-0 z-[1] rounded-[var(--radius-card)]"
      />
      <CardChevron />
      <TileLabel>Portfolio · {int(audits)} audits</TileLabel>
      <div className="swap min-h-0 flex-1">
        <div className="swap-a flex min-h-0 flex-col justify-end gap-[clamp(8px,1.4svh,16px)]">
          <div className="flex items-end justify-between gap-3">
            <p className={`${BIG} shrink-0`} aria-label={ok ? `${pct(avgScore)} percent` : 'No score'}>
              {ok ? <CountUp value={avgScore! * 100} format={whole} delay={0.25} /> : <span className="text-faint">—</span>}
              {ok && <span className="ml-0.5 text-[0.46em] tracking-normal text-muted">%</span>}
            </p>
            <div className="flex flex-col items-end gap-1.5 pb-[0.4em] text-[13px]">
              {band && <span className="badge px-2 py-[2px]" title={band}>{bandShort(band)}</span>}
              {delta !== null && <Signed d={Math.round(delta * 100)} />}
            </div>
          </div>
          {/* Contractors per band: one segmented bar, 2px surface gaps, labels under. */}
          <div data-testid="band-bar" className="flex flex-col gap-1.5" role="img" aria-label={shown.map((b) => `${bands[b]} ${b}`).join(', ')}>
            <div className="flex h-[clamp(8px,1.1svh,12px)] gap-[2px]">
              {shown.map((b, k) => (
                <motion.span
                  key={b}
                  className="h-full rounded-[4px]"
                  style={{ flexGrow: bands[b], flexBasis: 0, background: bandColor(b), transformOrigin: 'left' }}
                  initial={reduce ? false : { scaleX: 0, opacity: 0 }}
                  animate={{ scaleX: 1, opacity: 1 }}
                  transition={calm(0.4 + k * 0.12)}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] leading-none text-muted">
              {shown.map((b) => (
                <span key={b} className="inline-flex items-center gap-1 whitespace-nowrap">
                  <span className="size-[7px] rounded-full" style={{ background: bandColor(b) }} aria-hidden />
                  <span className="num font-semibold text-ink">{bands[b]}</span> {bandShort(b)}
                </span>
              ))}
            </div>
            <span className="sr-only">{total} contractors</span>
          </div>
        </div>
        <Insight insight={insight} />
      </div>
    </BentoCard>
  );
}

function Insight({ insight }: { insight: PortfolioInsight }) {
  const { best, worst, regions, excel } = insight;
  const row = (k: string, name: string, v: number | null, tone?: string) => (
    <li key={k} className="flex items-baseline justify-between gap-3 text-[12.5px]">
      <span className="min-w-0 truncate"><span className="text-muted">{k}</span> {name}</span>
      <span className="num shrink-0 font-semibold" style={tone ? { color: tone } : undefined}>{pct(v)}%</span>
    </li>
  );
  return (
    <div data-testid="kpi-score-insight" className="swap-b flex min-h-0 flex-col justify-end gap-2" aria-hidden>
      <ul className="flex flex-col gap-1">
        {best && row('Best', best.name, best.score, 'var(--up)')}
        {worst && row('Lowest', worst.name, worst.score, 'var(--down)')}
        {regions.map((r) => row(r.region, '', r.score))}
      </ul>
      {excel.audits > 0 && (
        <p className="rounded-[10px] bg-fill-2 px-2.5 py-1.5 text-[12px] leading-snug text-muted">
          <span className="font-semibold text-ink">{excel.differs} of {excel.audits}</span> Excel totals differ from their own points
          {excel.meanGap !== null && excel.differs > 0 && <> (avg {excel.meanGap > 0 ? '+' : '−'}{Math.abs(Math.round(excel.meanGap * 100))} pts)</>}. Shown: computed.
        </p>
      )}
    </div>
  );
}
