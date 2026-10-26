'use client';
import { TriangleAlert } from 'lucide-react';
import { CountUp } from '@/components/motion/CountUp';
import { int } from '@/lib/format';
import { BentoCard, TileLabel } from './BentoGrid';
import { BIG, PAD } from './parts';

/** S: high-risk work findings. */
export function HighRiskCard({ count }: { count: number }) {
  return (
    <BentoCard i={4} testid="kpi-highrisk" className={`tone-non ${PAD} justify-between gap-1 min-[640px]:col-span-2`}>
      <TileLabel tone="var(--tone)">
        <TriangleAlert size={15} strokeWidth={2.4} aria-hidden />
        High-risk work
      </TileLabel>
      <p className={BIG}>
        <CountUp value={count} format={int} duration={1.2} delay={0.36} />
      </p>
      <p className="text-[13px] leading-tight text-muted">Permits, lifting, height, electrical</p>
    </BentoCard>
  );
}
