'use client';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { TriangleAlert } from 'lucide-react';
import { CountUp } from '@/components/motion/CountUp';
import { int } from '@/lib/format';
import type { Quarter } from '@/lib/types';
import { BentoCard, TileLabel } from './BentoGrid';
import { BIG, PAD } from './parts';

/**
 * S: high-risk work findings, with a tiny Q4 vs Q1 two-bar (counts per quarter; more is worse, so a rise is red and a
 * fall green). The whole tile opens the Permits & High-Risk Work category.
 */
export function HighRiskCard({ count, byQuarter, href }: { count: number; byQuarter: { quarter: Quarter; count: number }[]; href: string }) {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...byQuarter.map((b) => b.count));
  const [a, b] = byQuarter;
  const last = !a || !b ? 'var(--muted)' : b.count > a.count ? 'var(--down)' : b.count < a.count ? 'var(--up)' : 'var(--muted)';
  return (
    <BentoCard i={4} testid="kpi-highrisk" className={`tone-non ${PAD} lift justify-between gap-1 min-[640px]:col-span-2`}>
      <Link
        href={href}
        aria-label={`High-risk work: ${count} findings. Open Permits & High-Risk Work`}
        className="absolute inset-0 z-[1] rounded-[var(--radius-card)]"
      />
      <TileLabel tone="var(--tone)">
        <TriangleAlert size={15} strokeWidth={2.4} aria-hidden />
        High-risk work
      </TileLabel>
      <div className="flex items-end justify-between gap-3">
        <p className={BIG}>
          <CountUp value={count} format={int} duration={1.2} delay={0.36} />
        </p>
        <div
          data-testid="highrisk-bars"
          role="img"
          aria-label={byQuarter.map((q) => `${q.quarter.replace('-', ' ')}: ${q.count}`).join(', ')}
          className="flex items-end gap-[clamp(4px,0.4vw,8px)] pb-[0.35em]"
        >
          {byQuarter.map((q, k) => (
            <div key={q.quarter} className="flex flex-col items-center gap-1">
              <div className="flex h-[clamp(34px,6svh,64px)] w-[clamp(10px,0.9vw,16px)] items-end">
                <motion.span
                  data-testid="highrisk-bar"
                  className="block w-full rounded-[4px]"
                  style={{
                    height: `${Math.max(4, (q.count / max) * 100)}%`,
                    background: k === byQuarter.length - 1 ? last : 'color-mix(in srgb, var(--muted) 40%, transparent)',
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
      </div>
      <p className="text-[13px] leading-tight text-muted">high-risk findings</p>
    </BentoCard>
  );
}
