'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { CountUp } from '@/components/motion/CountUp';
import { HandoffLink } from '@/components/motion/HandoffLink';
import { int } from '@/lib/format';
import { POSITIVES_CARD, POSITIVES_FIGURE } from '@/lib/handoff';
import { BentoCard, TileLabel } from './BentoGrid';
import { BIG, CardChevron, PAD } from './parts';

/**
 * S: positive observations (good practice the auditors noted), with how widely they were recorded: a bar of the audits
 * that noted at least one, and the contractors behind them. Coverage, not a quarter trend: how many positives an auditor
 * writes down varies by auditor more than by site. The whole tile opens /positives with the shared hand-off: the tile
 * grows into the view's header strip and the figure flies into its header figure (lib/handoff).
 */
export function PositivesCard({ summary, href }: {
  summary: { total: number; audits: number; auditsWith: number; contractors: number; contractorsWith: number };
  href: string;
}) {
  const reduce = useReducedMotion();
  const { total, audits, auditsWith, contractors, contractorsWith } = summary;
  return (
    <BentoCard i={4} testid="kpi-positives" handoff={POSITIVES_CARD} className={`tone-good ${PAD} lift group justify-between gap-1 min-[640px]:col-span-2`}>
      <HandoffLink
        href={href}
        aria-label={`Positive observations: ${total}, in ${auditsWith} of ${audits} audits. Open details`}
        className="absolute inset-0 z-[1] rounded-[var(--radius-card)]"
      />
      <CardChevron />
      <TileLabel tone="var(--tone)" className="pr-8">Positive observations</TileLabel>
      <p data-testid="positives-count" data-handoff={POSITIVES_FIGURE} className={BIG}>
        <CountUp value={total} format={int} duration={1.2} delay={0.36} />
      </p>
      <div className="flex flex-col gap-1.5">
        <span
          role="img"
          aria-label={`Noted in ${auditsWith} of ${audits} audits`}
          className="relative block h-[clamp(8px,1.1svh,12px)] w-full overflow-hidden rounded-full bg-fill-2"
        >
          <motion.span
            data-testid="positives-coverage-bar"
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${audits ? (auditsWith / audits) * 100 : 0}%`, background: 'var(--tone-dot)', transformOrigin: 'left' }}
            initial={reduce ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.42 }}
          />
        </span>
        <p data-testid="positives-coverage" className="text-[12px] leading-tight text-muted">
          <span className="whitespace-nowrap"><span className="num font-semibold text-ink">{auditsWith}</span> of {audits} audits</span> ·{' '}
          <span className="whitespace-nowrap"><span className="num font-semibold text-ink">{contractorsWith}</span> of {contractors} contractors</span>
        </p>
      </div>
    </BentoCard>
  );
}
