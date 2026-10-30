'use client';
import { CountUp } from '@/components/motion/CountUp';
import { bandColor, bandShort, bandTone, pct } from '@/lib/format';
import type { LiveScore } from '@/lib/input/score';
import { DUR } from '@/lib/motion';
import { Bar } from './ui';

const fmtPct = (n: number) => String(Math.round(n * 100));
const fmtInt = (n: number) => String(Math.round(n));

const SHORT: Record<string, string> = { A: 'Management', B: 'Site processes', C: 'Planning' };

/**
 * The live score: total %, band, section bars and counts, gliding to new values as answers change.
 * `compact`: one sticky strip for narrow screens.
 */
export function ScorePanel({ score, reported, compact = false }: { score: LiveScore; reported: number | null; compact?: boolean }) {
  const tone = score.band ? `tone-${bandTone(score.band)}` : '';
  const total = score.total;
  const c = score.counts;
  if (compact) {
    return (
      <div className={`glass flex items-center gap-3 rounded-2xl px-4 py-2.5 ${tone}`} data-testid="score-strip">
        <p className="figure text-[28px]">
          {total === null ? '—' : <CountUp value={total} format={fmtPct} duration={DUR} />}
          <span className="ml-0.5 text-[0.5em] tracking-normal text-muted">%</span>
        </p>
        {score.band && <span className="badge px-2 py-[2px] text-[12px]">{bandShort(score.band)}</span>}
        <span className="ml-auto flex items-center gap-3 text-[12px] text-muted">
          <span><span className="num font-semibold text-ink">{c.answered}</span>/{c.items}</span>
          <span><span className="num font-semibold text-ink">{c.findings}</span> findings</span>
        </span>
      </div>
    );
  }
  return (
    <section className={`card flex flex-col gap-5 p-5 ${tone}`} aria-label="Live score" data-testid="score-panel">
      <div className="flex items-end justify-between gap-3">
        <p className="figure text-[clamp(56px,8svh,76px)]" data-testid="live-total">
          {total === null ? '—' : <CountUp value={total} format={fmtPct} duration={DUR} />}
          <span className="ml-0.5 text-[0.4em] tracking-normal text-muted">%</span>
        </p>
        {score.band ? (
          <span className="badge mb-2 px-2.5 py-[3px] text-[13px]" data-testid="live-band">{score.band}</span>
        ) : (
          <span className="mb-2 text-[13px] text-faint">No answers yet</span>
        )}
      </div>
      <Bar value={total} color={score.band ? bandColor(score.band) : 'var(--control)'} className="h-[10px]" />
      <ul className="grid gap-2.5" aria-label="Section scores">
        {score.sections.map((s) => (
          <li key={s.code} className="grid grid-cols-[1.4em_minmax(0,1fr)_3ch] items-center gap-x-2.5 gap-y-1 text-[13px]">
            <span className="font-semibold text-muted">{s.code}</span>
            <span className="truncate text-muted" title={s.label}>{(score.cParts.length > 0 && SHORT[s.code]) || s.label}</span>
            <span className="num text-right font-semibold">{pct(s.ratio)}</span>
            <span />
            <span className="col-span-2"><Bar value={s.ratio} /></span>
          </li>
        ))}
      </ul>
      {score.cParts.length > 0 && (
        <p className="-mt-2 text-[12px] text-faint">C = average of C1 {pct(score.cParts[0].ratio)}% and C2 {pct(score.cParts[1].ratio)}%</p>
      )}
      <dl className="grid grid-cols-3 gap-2 border-t border-[var(--hairline)] pt-4">
        {[
          ['Answered', c.answered, `/${c.items}`],
          ['Findings', c.findings, ''],
          ['N/A', c.na, ''],
        ].map(([k, v, suffix]) => (
          <div key={k as string}>
            <dt className="text-[12px] font-semibold text-muted">{k}</dt>
            <dd className="num mt-0.5 text-[20px] font-semibold tracking-[-0.02em]">
              <CountUp value={v as number} format={fmtInt} duration={DUR} />
              <span className="text-[13px] font-normal text-faint">{suffix}</span>
            </dd>
          </div>
        ))}
      </dl>
      {reported !== null && (
        <p className="text-[12px] text-faint" data-testid="excel-says">
          Excel says {pct(reported)}% · computed {pct(total)}%
        </p>
      )}
    </section>
  );
}
