'use client';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { CountUp } from '@/components/motion/CountUp';
import { dateLabel, int } from '@/lib/format';
import { calm, STAGGER } from '@/lib/motion';
import { BentoCard, TileLabel } from './BentoGrid';
import { CardChevron, MID, PAD } from './parts';

/**
 * S: how many audits were conducted (the filter's audits), split by quarter as small bars. Hover: how many contractors,
 * and the first and latest audit dates. Opens the audits log.
 */
export function AuditsCard({ total, byQuarter, contractors, first, last, href }: {
  total: number; byQuarter: { label: string; count: number }[]; contractors: number;
  first: string | null; last: string | null; href: string;
}) {
  const reduce = useReducedMotion();
  return (
    <BentoCard i={6} testid="kpi-audits" className={`${PAD} lift reveal-host group gap-2 min-[640px]:col-span-2`}>
      <Link href={href} aria-label={`${total} audits conducted. Open the audits log`} className="absolute inset-0 z-[1] rounded-[var(--radius-card)]" />
      <CardChevron small />
      <TileLabel>Audits conducted</TileLabel>
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-1.5">
        <p data-testid="audits-count" className={MID}>
          <CountUp value={total} format={int} delay={0.4} />
        </p>
        <div className="swap min-w-0">
          <div className="swap-a flex min-w-0 flex-col gap-1.5" data-testid="audits-by-quarter">
            {/* The quarters as one segmented bar, labels under. */}
            <div className="flex h-[clamp(6px,0.9svh,9px)] gap-[2px]" aria-hidden>
              {byQuarter.map((q, k) => (
                <motion.span
                  key={q.label}
                  className="h-full rounded-[4px]"
                  style={{ flexGrow: q.count, flexBasis: 0, background: k % 2 ? 'var(--bar)' : 'color-mix(in srgb, var(--bar) 55%, transparent)', transformOrigin: 'left' }}
                  initial={reduce ? false : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={calm(0.5 + k * STAGGER)}
                />
              ))}
            </div>
            <p className="flex flex-wrap gap-x-3 text-[12px] text-muted">
              {byQuarter.map((q) => (
                <span key={q.label} className="whitespace-nowrap"><span className="num font-semibold text-ink">{q.count}</span> {q.label}</span>
              ))}
            </p>
          </div>
          <ul className="swap-b flex min-w-0 flex-col gap-0.5 text-[12px]" aria-hidden data-testid="audits-insight">
            <li className="flex justify-between gap-2"><span className="text-muted">Contractors</span><span className="num font-semibold">{contractors}</span></li>
            {first && last && <li className="flex justify-between gap-2"><span className="text-muted">Dates</span><span className="num font-semibold">{dateLabel(first, false)} – {dateLabel(last, false)}</span></li>}
          </ul>
        </div>
      </div>
    </BentoCard>
  );
}
