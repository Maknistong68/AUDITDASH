'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { CountUp } from '@/components/motion/CountUp';
import { HandoffLink } from '@/components/motion/HandoffLink';
import type { RegionSide } from '@/lib/analytics';
import { bandShort, bandTone, pct, quarterLabel } from '@/lib/format';
import { REGIONS_CARD } from '@/lib/handoff';
import { bandFor } from '@/lib/scoring';
import type { Quarter } from '@/lib/types';
import { BentoCard, TileLabel } from './BentoGrid';
import { PAD, Signed, whole } from './parts';

const BAND_TICKS = [0.6, 0.7, 0.8, 0.9];
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/**
 * Wide tile: SR1 vs SR2 for the quarter, the comparison the two subregion directors look at first. Each side: average
 * official score, its band, change vs the quarter before, and the base (audits · contractors) so 9 contractors vs 3 is
 * never hidden. The leader line says who is ahead and by how much. The whole tile opens /audits, landing in its regions panel.
 */
export function RegionDuelCard({ quarter, previousQuarter, sides, portfolio, audits, href }: {
  quarter: Quarter; previousQuarter: Quarter | null; sides: RegionSide[]; portfolio: number | null; audits: number; href: string;
}) {
  const scored = sides.filter((s): s is RegionSide & { score: number } => s.score !== null);
  const [a, b] = scored;
  const gap = a && b ? Math.round(a.score * 100) - Math.round(b.score * 100) : null;
  const leader = gap === null ? null : gap === 0 ? 'Level' : `${gap > 0 ? a.region : b.region} ahead by ${plural(Math.abs(gap), 'pt')}`;
  return (
    <BentoCard i={2} press testid="kpi-regions" handoff={REGIONS_CARD} className={`${PAD} lift group gap-[clamp(6px,1.1svh,12px)] col-span-full`}>
      <HandoffLink
        href={href}
        aria-label={`SR1 vs SR2, ${quarterLabel(quarter)}: ${sides.map((s) => `${s.region} ${s.score === null ? 'no audits' : `${pct(s.score)}%`}`).join(', ')}. Open portfolio`}
        className="absolute inset-0 z-[1] rounded-[var(--radius-card)]"
      />
      <div className="flex items-baseline justify-between gap-3">
        <TileLabel>
          <span className="text-ink">SR1 vs SR2</span>
          <span aria-hidden>·</span> {quarterLabel(quarter)}
        </TileLabel>
        {portfolio !== null && (
          <p data-testid="regions-portfolio" className="text-[13px] text-muted">
            Portfolio <span className="num font-semibold text-ink">{pct(portfolio)}%</span>
          </p>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-[clamp(8px,1.4svh,16px)]">
        {sides.map((s, i) => (
          <Side key={s.region} side={s} i={i} lead={gap !== null && gap !== 0 && s === (gap > 0 ? a : b)} previousQuarter={previousQuarter} />
        ))}
      </div>
      <p data-testid="regions-footnote" className="flex flex-wrap items-baseline justify-between gap-x-3 text-[12px] text-muted">
        {leader && <span data-testid="regions-leader" className="font-semibold text-ink">{leader}</span>}
        <span>Average Total Final Score · {plural(audits, 'audit')}</span>
      </p>
    </BentoCard>
  );
}

function Side({ side, i, lead, previousQuarter }: { side: RegionSide; i: number; lead: boolean; previousQuarter: Quarter | null }) {
  const reduce = useReducedMotion();
  const { region, score, previous, audits, contractors } = side;
  const band = score === null ? null : bandFor(score);
  const d = score !== null && previous !== null ? Math.round(score * 100) - Math.round(previous * 100) : null;
  const delay = 0.3 + i * 0.12;
  return (
    <div data-testid="region-side" data-region={region} className={`grid grid-cols-[3.2em_minmax(0,1fr)_auto] items-center gap-x-[clamp(10px,1vw,18px)] ${band ? `tone-${bandTone(band)}` : ''}`}>
      <span className={`text-[clamp(15px,1.9svh,19px)] font-semibold tracking-[-0.02em] ${lead ? 'text-ink' : 'text-muted'}`}>{region}</span>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="relative block h-[clamp(10px,1.4svh,14px)] w-full rounded-full bg-fill-2" aria-hidden>
          {BAND_TICKS.map((t) => (
            <span key={t} className="absolute inset-y-0 z-[1] w-[2px] -translate-x-1/2 bg-surface" style={{ left: `${t * 100}%` }} />
          ))}
          {score !== null && (
            <motion.span
              layout={reduce ? false : 'size'}
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${Math.min(1, Math.max(0, score)) * 100}%`, background: 'var(--tone-dot)', transformOrigin: 'left' }}
              initial={reduce ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ type: 'spring', stiffness: 90, damping: 19, delay }}
            />
          )}
        </span>
        <span className="flex flex-wrap items-baseline gap-x-2 text-[12px] text-muted">
          <span>{audits} {audits === 1 ? 'audit' : 'audits'} · {contractors} {contractors === 1 ? 'contractor' : 'contractors'}</span>
          {d !== null && previousQuarter && (
            <span className="inline-flex items-baseline gap-1">
              <Signed d={d} /> vs {quarterLabel(previousQuarter).slice(0, 2)}
            </span>
          )}
        </span>
      </div>
      <span className="flex items-baseline gap-2">
        <span data-testid="region-score" className="figure text-[clamp(26px,4.2svh,46px)]">
          {score === null ? <span className="text-faint">—</span> : <><CountUp value={score * 100} format={whole} duration={1.1} delay={delay} /><span className="text-[0.45em] tracking-normal text-muted">%</span></>}
        </span>
        {band && <span className="badge px-2 py-[2px] text-[12px]" title={band}>{bandShort(band)}</span>}
      </span>
    </div>
  );
}
