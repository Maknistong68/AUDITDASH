'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { CountUp } from '@/components/motion/CountUp';
import { bandShort, bandTone, deltaPoints, int, pct } from '@/lib/format';
import type { Band, Filter } from '@/lib/types';
import { BentoCard, TileLabel } from './BentoGrid';
import { BIG, PAD, ScoreBar, Signed, SubLabel, whole } from './parts';

const BANDS: Band[] = ['Excellent', 'Good', 'Partially Compliant', 'Minimally Compliant', 'Non-Compliant'];

/**
 * Audit overview: portfolio score (average official score over the filtered audits) with its band and Δ,
 * the audit count, and contractors per band (segmented bar + the five counts, zeros grey).
 */
export function AuditOverviewCard({ avgScore, band, delta, audits, quarter, byQuarter, bands }: {
  avgScore: number | null; band: Band | null; delta: number | null; audits: number; quarter: Filter['quarter'];
  byQuarter: { label: string; value: number | null }[]; bands: Record<Band, number>;
}) {
  const reduce = useReducedMotion();
  const ok = avgScore !== null && Number.isFinite(avgScore);
  // The delta is the difference of the quarter averages as displayed (each rounded first), so it always matches them.
  const q1 = byQuarter.find((q) => q.label === 'Q1 2026')?.value ?? null;
  const q4 = byQuarter.find((q) => q.label === 'Q4 2025')?.value ?? null;
  const d = delta === null || q1 === null ? null : deltaPoints(q1, q4);
  const total = BANDS.reduce((s, b) => s + bands[b], 0);
  return (
    <BentoCard i={2} testid="audit-overview" label="Audit overview" className={`${PAD} gap-[clamp(8px,1.4svh,16px)] min-[640px]:col-span-7`}>
      <div className="flex items-baseline justify-between gap-3">
        <TileLabel className="text-ink">Audit overview</TileLabel>
        <p data-testid="audit-count" className="num text-[13px] text-muted">
          <span className="font-semibold text-ink">{int(audits)}</span> {audits === 1 ? 'audit' : 'audits'}
        </p>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-x-[clamp(16px,1.6vw,32px)] gap-y-4 min-[480px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div data-testid="kpi-score" className={`flex min-w-0 flex-col justify-between gap-[clamp(6px,1svh,12px)] ${band ? `tone-${bandTone(band)}` : ''}`}>
          <SubLabel>Portfolio score</SubLabel>
          <div data-testid="score-ring" className="flex flex-col gap-[clamp(6px,1.1svh,12px)]">
            <div className="flex items-end gap-2.5">
              <p className={BIG} aria-label={ok ? `${pct(avgScore)} percent` : 'No score'}>
                {ok ? <CountUp value={avgScore! * 100} format={whole} duration={1.2} delay={0.25} /> : <span className="text-faint">—</span>}
                {ok && <span className="ml-0.5 text-[0.46em] tracking-normal text-muted">%</span>}
              </p>
              {band && <span className="badge mb-[0.45em] px-2 py-[2px] text-[13px]" title={band}>{bandShort(band)}</span>}
            </div>
            {ok && <ScoreBar value={avgScore!} delay={0.3} />}
            {d !== null && (
              <p data-testid="kpi-score-delta" className="num inline-flex items-center gap-1 text-[13px]" title="Average of Q1 2026 audits minus average of Q4 2025 audits">
                {quarter === 'all' && <span className="text-muted">Q1 vs Q4</span>}
                <Signed d={d} />
                {quarter !== 'all' && <span className="text-muted">vs Q4 2025</span>}
              </p>
            )}
          </div>
        </div>
        <div data-testid="kpi-bands" className="flex min-w-0 flex-col justify-between gap-[clamp(6px,1svh,12px)] min-[480px]:border-l min-[480px]:border-[var(--hairline)] min-[480px]:pl-[clamp(16px,1.6vw,32px)]">
          <SubLabel>Contractors by band</SubLabel>
          <div className="flex h-[clamp(8px,1.1svh,12px)] w-full shrink-0 gap-[3px] overflow-hidden rounded-full" role="img" aria-label={BANDS.map((b) => `${b} ${bands[b]}`).join(', ')}>
            {total === 0 && <span className="h-full w-full rounded-full bg-fill" />}
            {BANDS.filter((b) => bands[b] > 0).map((b, k) => (
              <motion.span
                key={b}
                className={`tone-${bandTone(b)} block h-full first:rounded-l-full last:rounded-r-full`}
                style={{ background: 'var(--tone-dot)', flexBasis: `${(bands[b] / total) * 100}%`, transformOrigin: 'left' }}
                initial={reduce ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.35 + k * 0.08 }}
              />
            ))}
          </div>
          <ul className="grid gap-[clamp(0px,0.3svh,4px)]">
            {BANDS.map((b) => {
              const n = bands[b];
              return (
                <li key={b} className={`tone-${bandTone(b)} flex items-center justify-between gap-2 text-[13px] leading-[1.35]`} title={b}>
                  <span className="flex items-center gap-1.5 text-muted">
                    <span className="size-[7px] rounded-full" style={{ background: 'var(--tone-dot)', opacity: n === 0 ? 0.35 : 1 }} aria-hidden />
                    {bandShort(b)}
                  </span>
                  <span className={`num font-semibold ${n === 0 ? 'text-faint' : ''}`}>{n}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </BentoCard>
  );
}
