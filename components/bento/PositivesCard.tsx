'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { CountUp } from '@/components/motion/CountUp';
import { HandoffLink } from '@/components/motion/HandoffLink';
import { int } from '@/lib/format';
import { POSITIVES_CARD, POSITIVES_FIGURE } from '@/lib/handoff';
import { BentoCard, TileLabel } from './BentoGrid';
import { CardChevron, MID, PAD } from './parts';
import { EASE, DUR } from '@/lib/motion';

/**
 * Wide (the bento's bottom row): positive observations (good practice the auditors noted), with how widely they were recorded: a bar of the audits
 * that noted at least one, and the contractors behind them. Coverage, not a quarter trend: how many positives an auditor
 * writes down varies by auditor more than by site. The whole tile opens /positives with the shared hand-off: the tile
 * grows into the view's header strip and the figure flies into its header figure (lib/handoff).
 */
export function PositivesCard({ summary, leaders, href }: {
  summary: { total: number; audits: number; auditsWith: number; contractors: number; contractorsWith: number };
  /** Most good practice per audit, best first: the hover layer. */
  leaders: { name: string; count: number; perAudit: number }[];
  href: string;
}) {
  const reduce = useReducedMotion();
  const { total, audits, auditsWith } = summary;
  return (
    <BentoCard i={7} testid="kpi-positives" handoff={POSITIVES_CARD} className={`tone-good ${PAD} lift reveal-host group justify-between gap-2 min-[640px]:col-span-2`}>
      <HandoffLink
        href={href}
        aria-label={`Positive observations: ${total}, in ${auditsWith} of ${audits} audits. Open details`}
        className="absolute inset-0 z-[1] rounded-[var(--radius-card)]"
      />
      <CardChevron small />
      <TileLabel tone="var(--tone)" className="pr-5">Positives</TileLabel>
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-1.5">
      <p data-testid="positives-count" data-handoff={POSITIVES_FIGURE} className={`${MID} shrink-0`}>
        <CountUp value={total} format={int} delay={0.36} />
      </p>
      <div className="swap min-w-0">
      <div className="swap-a flex min-w-0 flex-col justify-end gap-1.5">
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
            transition={{ type: 'tween', ease: EASE, duration: DUR, delay: 0.5 }}
          />
        </span>
        <p data-testid="positives-coverage" className="text-[12px] leading-tight text-muted">
          <span className="whitespace-nowrap"><span className="num font-semibold text-ink">{auditsWith}</span>/{audits} audits</span>
        </p>
      </div>
      <ol data-testid="positives-leaders" aria-hidden className="swap-b flex min-w-0 flex-col justify-end gap-0.5 text-[12.5px]">
        {leaders.slice(0, 2).map((l) => (
          <li key={l.name} className="flex min-w-0 items-baseline justify-between gap-2">
            <span className="truncate font-semibold">{l.name}</span>
            <span className="num shrink-0 text-muted">{l.count}</span>
          </li>
        ))}
      </ol>
      </div>
      </div>
    </BentoCard>
  );
}
