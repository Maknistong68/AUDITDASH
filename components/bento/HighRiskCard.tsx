'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { TriangleAlert } from 'lucide-react';
import { CountUp } from '@/components/motion/CountUp';
import { HandoffLink } from '@/components/motion/HandoffLink';
import { int } from '@/lib/format';
import { HIGHRISK_CARD, HIGHRISK_FIGURE } from '@/lib/handoff';
import type { Quarter } from '@/lib/types';
import { BentoCard, TileLabel } from './BentoGrid';
import { BIG, CardChevron, PAD } from './parts';

/**
 * S: high-risk work findings (total), with a tiny per-quarter bar of findings per audit (quarters have different audit
 * counts, so raw counts would mislead). More is worse: the latest bar is red when it rose, green when it fell.
 * The whole tile opens /high-risk with the shared hand-off: the tile grows into the view's header strip and the figure
 * flies into its header figure (lib/handoff).
 */
export function HighRiskCard({ count, byQuarter, href }: {
  count: number; byQuarter: { quarter: Quarter; count: number; audits: number }[]; href: string;
}) {
  const reduce = useReducedMotion();
  const rates = byQuarter.map((q) => ({ ...q, rate: q.count / q.audits }));
  const max = Math.max(1e-9, ...rates.map((r) => r.rate));
  const [a, b] = rates;
  const last = !a || !b ? 'var(--tone-dot)' : b.rate > a.rate ? 'var(--down)' : b.rate < a.rate ? 'var(--up)' : 'var(--muted)';
  return (
    <BentoCard i={4} testid="kpi-highrisk" handoff={HIGHRISK_CARD} className={`tone-non ${PAD} lift group justify-between gap-1 min-[640px]:col-span-2`}>
      <HandoffLink
        href={href}
        aria-label={`High-risk work: ${count} findings. Open details`}
        className="absolute inset-0 z-[1] rounded-[var(--radius-card)]"
      />
      <CardChevron />
      <TileLabel tone="var(--tone)">
        <TriangleAlert size={15} strokeWidth={2.4} aria-hidden />
        High-risk work
      </TileLabel>
      <div className="flex items-end justify-between gap-3">
        <p data-testid="highrisk-count" data-handoff={HIGHRISK_FIGURE} className={BIG}>
          <CountUp value={count} format={int} duration={1.2} delay={0.36} />
        </p>
        <div className="flex flex-col items-center gap-1 pb-[0.2em]">
          <div
            data-testid="highrisk-bars"
            role="img"
            aria-label={`Findings per audit: ${rates.map((r) => `${r.quarter.replace('-', ' ')} ${r.rate.toFixed(1)}`).join(', ')}`}
            className="flex items-end gap-[clamp(6px,0.5vw,10px)]"
          >
            {rates.map((q, k) => (
              <div key={q.quarter} className="flex flex-col items-center gap-[3px]">
                <span data-testid="highrisk-rate" className="num text-[11px] font-semibold leading-none">{q.rate.toFixed(1)}</span>
                <div className="flex h-[clamp(26px,4.6svh,52px)] w-[clamp(10px,0.9vw,16px)] items-end">
                  <motion.span
                    data-testid="highrisk-bar"
                    className="block w-full rounded-[4px]"
                    style={{
                      height: `${Math.max(4, (q.rate / max) * 100)}%`,
                      background: k === rates.length - 1 ? last : 'color-mix(in srgb, var(--muted) 40%, transparent)',
                      transformOrigin: 'bottom',
                    }}
                    initial={reduce ? false : { scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.4 + k * 0.1 }}
                  />
                </div>
                <span className="num text-[11px] leading-none text-muted">{q.quarter.slice(0, 2)}</span>
              </div>
            ))}
          </div>
          {rates.length > 0 && <span className="whitespace-nowrap text-[11px] leading-none text-muted">per audit</span>}
        </div>
      </div>
      <p className="text-[13px] leading-tight text-muted">high-risk findings</p>
    </BentoCard>
  );
}
