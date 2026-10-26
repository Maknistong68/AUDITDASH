'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowUp, Repeat2, TriangleAlert } from 'lucide-react';
import { SingleRing } from '@/components/charts/ActivityRings';
import { CountUp } from '@/components/motion/CountUp';
import { bandShort, bandTone, int, pct } from '@/lib/format';
import type { Band } from '@/lib/types';

const BANDS: Band[] = ['Excellent', 'Good', 'Partially Compliant', 'Minimally Compliant', 'Non-Compliant'];
const whole = (n: number) => String(Math.round(n));
const SPRING = { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 } as const;

interface Props {
  avgScore: number | null;
  band: Band | null;
  delta: number | null;
  audits: number;
  bands: Record<Band, number>;
  repeats: number | null;
  highRisk: number;
}

function Cell({ i, testid, className, children }: { i: number; testid: string; className?: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      data-testid={testid}
      initial={reduce ? false : { opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...SPRING, delay: 0.04 + i * 0.06 }}
      className={`glass flex min-w-0 flex-col justify-between rounded-[var(--radius-card)] px-[clamp(16px,1.5vw,28px)] py-[clamp(12px,1.7svh,22px)] ${className ?? ''}`}
    >
      {children}
    </motion.section>
  );
}

function Label({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <h2 className="flex items-center gap-1.5 text-[clamp(13px,1.45svh,15px)] font-semibold tracking-[-0.01em]" style={{ color: tone ?? 'var(--muted)' }}>
      {children}
    </h2>
  );
}

const BIG = 'figure text-[clamp(40px,6.4svh,72px)]';

/** The top strip: portfolio score (ring + count-up), contractors per band, repeat and high-risk findings. */
export function TopStrip({ avgScore, band, delta, audits, bands, repeats, highRisk }: Props) {
  const ok = avgScore !== null && Number.isFinite(avgScore);
  const tone = band ? bandTone(band) : null;
  const d = delta === null ? null : Math.round(delta * 100);
  const total = BANDS.reduce((s, b) => s + bands[b], 0);

  return (
    <div className="grid grid-cols-1 gap-[var(--gap-grid)] min-[640px]:grid-cols-2 min-[1200px]:grid-cols-[1.25fr_1.55fr_1fr_1fr]">
      <Cell i={0} testid="kpi-score" className={tone ? `tone-${tone}` : ''}>
        <div data-testid="score-ring" className="flex h-full min-h-0 items-center gap-[clamp(14px,1.4vw,24px)]">
          <SingleRing
            value={ok ? avgScore : null}
            color="var(--tone-dot, var(--faint))"
            end="color-mix(in oklab, var(--tone-dot, var(--faint)) 55%, white)"
            delay={0.25}
            className="aspect-square h-[clamp(64px,10.5svh,116px)] shrink-0"
            label={ok ? `Portfolio score ${pct(avgScore)}%` : 'No score'}
          />
          <div className="flex min-w-0 flex-col gap-[clamp(4px,0.8svh,10px)]">
            <Label>Portfolio · {int(audits)} audits</Label>
            <p className={BIG} aria-label={ok ? `${pct(avgScore)} percent` : 'No score'}>
              {ok ? <CountUp value={avgScore! * 100} format={whole} duration={1.3} delay={0.2} /> : <span className="text-faint">—</span>}
              {ok && <span className="ml-0.5 text-[0.5em] font-semibold tracking-normal text-muted">%</span>}
            </p>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px]">
              {band && <span className="badge px-2 py-0.5 text-[13px]" title={band}>{bandShort(band)}</span>}
              {d !== null && (
                <span className="num inline-flex items-center gap-0.5 font-semibold" style={{ color: d > 0 ? 'var(--up)' : d < 0 ? 'var(--down)' : 'var(--muted)' }}>
                  {d > 0 && <ArrowUp size={13} strokeWidth={2.6} aria-hidden />}
                  {d < 0 && <ArrowDown size={13} strokeWidth={2.6} aria-hidden />}
                  {d > 0 ? '+' : d < 0 ? '−' : '±'}
                  {Math.abs(d)}
                  <span className="ml-1 font-normal text-muted">vs Q4 2025</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </Cell>

      <Cell i={1} testid="kpi-bands">
        <Label>Contractors by band</Label>
        <div
          className="flex h-[clamp(12px,1.7svh,18px)] w-full gap-[3px] overflow-hidden rounded-full"
          role="img"
          aria-label={BANDS.map((b) => `${b} ${bands[b]}`).join(', ')}
        >
          {total === 0 && <span className="h-full w-full rounded-full bg-fill" />}
          {BANDS.filter((b) => bands[b] > 0).map((b, k) => (
            <BandSegment key={b} band={b} share={bands[b] / total} k={k} />
          ))}
        </div>
        <ul className="flex flex-wrap justify-between gap-x-3 gap-y-1">
          {BANDS.map((b) => {
            const n = bands[b];
            return (
              <li key={b} className={`tone-${bandTone(b)} flex flex-col gap-0.5`} title={b}>
                <span className={`figure text-[clamp(20px,3svh,32px)] ${n === 0 ? 'text-faint' : ''}`}>{n}</span>
                <span className="flex items-center gap-1 whitespace-nowrap text-[13px] text-muted">
                  <span className="size-[7px] shrink-0 rounded-full" style={{ background: 'var(--tone-dot)', opacity: n === 0 ? 0.35 : 1 }} aria-hidden />
                  {bandShort(b)}
                </span>
              </li>
            );
          })}
        </ul>
      </Cell>

      <Cell i={2} testid="kpi-repeats" className="tone-minimal">
        <Label tone="var(--tone)">
          <Repeat2 size={16} strokeWidth={2.4} aria-hidden />
          Repeat findings
        </Label>
        <p className={BIG}>
          {repeats === null ? <span className="text-faint">—</span> : <CountUp value={repeats} format={int} duration={1.2} delay={0.3} />}
        </p>
        <p className="text-[13px] leading-tight text-muted">{repeats === null ? 'Needs an earlier quarter' : 'Same item failed again'}</p>
      </Cell>

      <Cell i={3} testid="kpi-highrisk" className="tone-non">
        <Label tone="var(--tone)">
          <TriangleAlert size={15} strokeWidth={2.4} aria-hidden />
          High-risk work
        </Label>
        <p className={BIG}>
          <CountUp value={highRisk} format={int} duration={1.2} delay={0.36} />
        </p>
        <p className="text-[13px] leading-tight text-muted">Permits, lifting, height, electrical</p>
      </Cell>
    </div>
  );
}

function BandSegment({ band, share, k }: { band: Band; share: number; k: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      className={`tone-${bandTone(band)} block h-full first:rounded-l-full last:rounded-r-full`}
      style={{ background: 'var(--tone-dot)', flexBasis: `${share * 100}%`, transformOrigin: 'left' }}
      initial={reduce ? false : { scaleX: 0, opacity: 0 }}
      animate={{ scaleX: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.3 + k * 0.08 }}
    />
  );
}
