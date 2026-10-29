'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { CountUp } from '@/components/motion/CountUp';
import { HandoffLink } from '@/components/motion/HandoffLink';
import type { Contractor, Quarter, Subregion } from '@/lib/types';
import { int, quarterLabel } from '@/lib/format';
import { PORTFOLIO_CARD } from '@/lib/handoff';
import { BentoCard, TileLabel } from './BentoGrid';
import { PAD } from './parts';

interface RegionCoverage { region: Subregion; audits: number; audited: number; contractors: number; missing: Contractor[] }

/**
 * M tile: audits done this quarter. The figure is the quarter's audits; per region, contractors audited out of the
 * region's contractors as a filling bar, then who is still waiting. The whole tile opens /audits (the audit timeline).
 */
export function CoverageCard({ quarter, regions, href }: { quarter: Quarter; regions: RegionCoverage[]; href: string }) {
  const reduce = useReducedMotion();
  const total = regions.reduce((s, r) => s + r.audits, 0);
  const missing = regions.flatMap((r) => r.missing);
  return (
    <BentoCard i={4} press testid="kpi-coverage" handoff={PORTFOLIO_CARD} className={`${PAD} lift group gap-[clamp(4px,0.8svh,10px)] min-[640px]:col-span-3`}>
      <HandoffLink
        href={href}
        aria-label={`Audits done in ${quarterLabel(quarter)}: ${total}. ${missing.length ? `Waiting: ${missing.map((c) => c.name).join(', ')}` : 'Every contractor audited'}. Open audit timeline`}
        className="absolute inset-0 z-[1] rounded-[var(--radius-card)]"
      />
      <TileLabel>
        <span className="text-ink">Audits done</span>
        <span aria-hidden>·</span> {quarterLabel(quarter)}
      </TileLabel>
      <div className="flex min-h-0 flex-1 items-center gap-[clamp(12px,1.2vw,20px)]">
        <p data-testid="coverage-total" className="figure shrink-0 text-[clamp(38px,6svh,72px)]">
          <CountUp value={total} format={int} duration={0.9} delay={0.35} />
        </p>
        <ul className="flex min-w-0 flex-1 flex-col gap-[clamp(6px,1svh,10px)]">
          {regions.map((r, i) => (
            <li key={r.region} data-testid="coverage-region" data-region={r.region} className="flex min-w-0 flex-col gap-1">
              <span className="flex items-baseline justify-between gap-2 text-[12.5px]">
                <span className="font-semibold">{r.region}</span>
                <span className="num text-muted">
                  <span className="font-semibold text-ink">{r.audited}</span> of {r.contractors} contractors
                </span>
              </span>
              <span className="relative block h-[6px] rounded-full bg-fill-2" aria-hidden>
                <motion.span
                  layout={reduce ? false : 'size'}
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${r.contractors ? (r.audited / r.contractors) * 100 : 0}%`,
                    background: r.audited === r.contractors ? 'var(--good-dot)' : 'var(--partial-dot)',
                    transformOrigin: 'left',
                  }}
                  initial={reduce ? false : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.4 + i * 0.1 }}
                />
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p data-testid="coverage-missing" className="truncate text-[12px] text-muted" title={missing.map((c) => c.name).join(', ')}>
        {missing.length === 0 ? 'Every contractor audited this quarter' : (
          <>Waiting: <span className="font-semibold text-ink">{missing.map((c) => c.name).join(', ')}</span></>
        )}
      </p>
    </BentoCard>
  );
}
