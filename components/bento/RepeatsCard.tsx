'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { calm, STAGGER } from '@/lib/motion';
import { CountUp } from '@/components/motion/CountUp';
import { HandoffLink } from '@/components/motion/HandoffLink';
import { int } from '@/lib/format';
import { REPEATS_CARD, REPEATS_FIGURE } from '@/lib/handoff';
import { BentoCard, TileLabel } from './BentoGrid';
import { BIG, CardChevron, PAD } from './parts';

/** One of the most repeated questions: its plain label and times repeated over all contractors. */
export interface TopRepeat { key: string; label: string; times: number }

/**
 * M: repeat findings, i.e. a question that is a finding in a contractor's audit and again in its next audit of the same
 * type (lib/analytics repeatMatrix). The figure is the total repeats; under it the three most repeated questions with
 * their times repeated. The whole tile opens /repeats with the shared hand-off: the tile grows into the view's header
 * strip and the figure flies into its header figure (lib/handoff).
 */
export function RepeatsCard({ repeats, top, byContractor, href }: {
  /** Total repeats; null when the filter has no follow-up audit (nothing to repeat yet). */
  repeats: number | null;
  top: TopRepeat[];
  /** Repeats per contractor, most first: the hover layer. */
  byContractor: { name: string; total: number }[];
  href: string;
}) {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...top.map((t) => t.times));
  const cmax = Math.max(1, ...byContractor.map((c) => c.total));
  return (
    <BentoCard i={4} testid="kpi-repeats" handoff={REPEATS_CARD} className={`tone-minimal ${PAD} lift reveal-host group justify-between gap-2 min-[640px]:col-span-3`}>
      <HandoffLink
        href={href}
        aria-label={`Repeat findings: ${repeats === null ? 'needs a follow-up audit' : `${repeats} repeats, questions noted again in the next audit`}. Open details`}
        className="absolute inset-0 z-[1] rounded-[var(--radius-card)]"
      />
      <CardChevron />
      <TileLabel tone="var(--tone)">
        Repeat findings
      </TileLabel>
      <div className="flex min-w-0 items-end gap-3">
        <p data-testid="repeats-count" data-handoff={REPEATS_FIGURE} className={`${BIG} shrink-0`}>
          {repeats === null ? <span className="text-faint">—</span> : <CountUp value={repeats} format={int} delay={0.3} />}
        </p>
        <p className="min-w-0 pb-[0.5em] text-[13px] leading-tight text-muted">
          {repeats === null ? 'Needs a follow-up audit' : <RepeatRule />}
        </p>
      </div>
      {repeats !== null && top.length > 0 && (
        <div className="swap">
          <ol data-testid="repeats-top" aria-label="Most repeated questions" className="swap-a flex min-w-0 flex-col gap-1">
            {top.map((t, k) => (
              <li key={t.key} data-testid="repeats-top-row" className="grid min-w-0 grid-cols-[minmax(0,1fr)_42px_2em] items-center gap-2 text-[12.5px] leading-[1.45]" title={t.label}>
                <span className="min-w-0 truncate">{t.label}</span>
                <span className="h-[5px] rounded-full bg-fill-2" aria-hidden>
                  <motion.span
                    className="block h-full rounded-full"
                    style={{ width: `${(t.times / max) * 100}%`, background: 'var(--tone-dot)', transformOrigin: 'left' }}
                    initial={reduce ? false : { scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={calm(0.5 + k * STAGGER)}
                  />
                </span>
                <span data-testid="repeats-top-times" className="num text-right font-semibold text-ink">×{t.times}</span>
              </li>
            ))}
          </ol>
          <ol data-testid="repeats-by-contractor" aria-hidden className="swap-b flex min-w-0 flex-col gap-1">
            {byContractor.slice(0, 3).map((c) => (
              <li key={c.name} className="grid min-w-0 grid-cols-[minmax(0,1fr)_42px_2em] items-center gap-2 text-[12.5px] leading-[1.45]">
                <span className="min-w-0 truncate font-semibold">{c.name}</span>
                <span className="h-[5px] rounded-full bg-fill-2">
                  <span className="block h-full rounded-full" style={{ width: `${(c.total / cmax) * 100}%`, background: 'var(--tone-dot)' }} />
                </span>
                <span className="num text-right font-semibold text-ink">{c.total}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </BentoCard>
  );
}

/** The rule in a few words, beside the figure. Card and /repeats header. */
export function RepeatRule() {
  return <span data-testid="repeats-rule">questions noted again in the next audit</span>;
}

/** "75 questions · 7 contractors": what the repeat count is made of (the /repeats heat map's rows and columns). */
export function RepeatStats({ questions, contractors }: { questions: number; contractors: number }) {
  const stat = (n: number, one: string, many: string, id: string) => (
    <span data-testid={id} className="whitespace-nowrap">
      <span className="num font-semibold text-ink">{n}</span> {n === 1 ? one : many}
    </span>
  );
  return (
    <p data-testid="repeats-stats" className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px] leading-tight text-muted">
      {stat(questions, 'question', 'questions', 'repeats-questions')}
      <span aria-hidden>·</span>
      {stat(contractors, 'contractor', 'contractors', 'repeats-contractors')}
    </p>
  );
}
