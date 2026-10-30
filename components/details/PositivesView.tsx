'use client';
import Link from 'next/link';
import { ThumbsUp } from 'lucide-react';
import { HandoffLanding } from '@/components/motion/HandoffLink';
import { POSITIVES_CARD, POSITIVES_FIGURE } from '@/lib/handoff';

export interface PositiveContractor { id: string; name: string; count: number; audits: number; perAudit: number; href: string }
export interface PositiveNote { id: string; text: string; contractor: string; date: string; href: string }
type Summary = { total: number; audits: number; auditsWith: number; contractors: number; contractorsWith: number };

/**
 * The /positives screen under the breadcrumb. Header strip (the landing of the dashboard card's hand-off): the figure,
 * how widely positives were recorded (audits and contractors with one) and the average per audit. Then two panels:
 * contractors ranked by positives per audit (bar ∝ per audit; none recorded last, muted; a row opens the contractor) and
 * the good practice itself, newest first, in its own scroll area (a note opens its audit on the Positive observations tab).
 */
export function PositivesView({ summary, contractors, notes, empty }: {
  summary: Summary; contractors: PositiveContractor[]; notes: PositiveNote[]; empty: string | null;
}) {
  return (
    <div className="tone-good flex min-h-0 flex-1 flex-col gap-[var(--gap-grid)] px-[var(--gutter)]">
      <HandoffLanding />
      <Header summary={summary} />
      {empty ? (
        <section data-testid="empty-state" className="card flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="figure text-[clamp(56px,10svh,112px)] text-faint" aria-hidden>0</p>
          <h2 className="text-[21px] font-semibold tracking-[-0.02em]">{empty}</h2>
        </section>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-[var(--gap-grid)] min-[900px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <Contractors rows={contractors} />
          <Notes notes={notes} />
        </div>
      )}
    </div>
  );
}

function Header({ summary }: { summary: Summary }) {
  const { total, audits, auditsWith, contractors, contractorsWith } = summary;
  const stat = (value: React.ReactNode, label: string, id: string) => (
    <div data-testid={id} className="flex flex-col gap-1">
      <span className="num text-[clamp(20px,2.8svh,30px)] font-semibold leading-none tracking-[-0.02em]">{value}</span>
      <span className="text-[12px] leading-tight text-muted">{label}</span>
    </div>
  );
  return (
    <section
      data-testid="positives-header"
      className="card grid shrink-0 grid-cols-1 items-center gap-x-[clamp(28px,5vw,110px)] gap-y-3 px-[clamp(16px,1.5vw,28px)] py-[clamp(10px,1.5svh,20px)] min-[700px]:grid-cols-[auto_minmax(0,1fr)]"
      style={{ viewTransitionName: POSITIVES_CARD }}
    >
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-1.5 text-[clamp(13px,1.5svh,16px)] font-semibold tracking-[-0.01em]" style={{ color: 'var(--tone)' }}>
          <ThumbsUp size={15} strokeWidth={2.4} aria-hidden />
          Positive observations
        </h1>
        <div className="flex items-end gap-3">
          <p data-testid="positives-figure" className="figure text-[clamp(40px,6.2svh,76px)]" style={{ viewTransitionName: POSITIVES_FIGURE }}>
            {total}
          </p>
          <p className="pb-[0.5em] text-[13px] leading-tight text-muted">good practice noted</p>
        </div>
      </div>
      {audits > 0 ? (
        <div className="flex flex-wrap items-center gap-x-[clamp(24px,4vw,72px)] gap-y-3">
          {stat(<>{auditsWith} <span className="text-[0.6em] font-normal text-muted">of {audits}</span></>, 'audits noted good practice', 'positives-audits')}
          {stat(<>{contractorsWith} <span className="text-[0.6em] font-normal text-muted">of {contractors}</span></>, 'contractors recognised', 'positives-contractors')}
          {stat((total / audits).toFixed(1), 'per audit, on average', 'positives-per-audit')}
        </div>
      ) : (
        <div />
      )}
    </section>
  );
}

function Contractors({ rows }: { rows: PositiveContractor[] }) {
  const max = Math.max(1e-9, ...rows.map((r) => r.perAudit));
  return (
    <section data-testid="positives-contractors" aria-labelledby="positives-contractors-h" className="card flex min-h-0 flex-col px-[clamp(14px,1.3vw,24px)] py-[clamp(10px,1.5svh,20px)]">
      <div className="flex shrink-0 items-baseline justify-between gap-3 pb-[clamp(6px,1svh,12px)]">
        <h2 id="positives-contractors-h" className="text-[clamp(14px,1.7svh,17px)] font-semibold tracking-[-0.01em]">By contractor</h2>
        <span className="text-[11px] leading-none text-muted">per audit</span>
      </div>
      <ol className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        {rows.map((r, k) => {
          const none = r.count === 0;
          return (
            <li key={r.id} className="flex min-h-[26px] flex-1 basis-0">
              <Link
                href={r.href}
                data-testid="positives-contractor"
                data-id={r.id}
                aria-label={`${r.name}: ${r.count} positive ${r.count === 1 ? 'observation' : 'observations'} in ${r.audits} ${r.audits === 1 ? 'audit' : 'audits'}. Open contractor`}
                className={`grid w-full grid-cols-[minmax(0,38%)_minmax(0,1fr)_auto] items-center gap-x-3 rounded-[8px] px-1.5 transition-colors hover:bg-fill-2 ${none ? 'text-muted' : ''}`}
              >
                <span className="truncate text-[clamp(12.5px,1.6svh,14.5px)]" title={r.name}>{r.name}</span>
                <span className="relative block h-[clamp(7px,1svh,10px)] rounded-full bg-fill-2" aria-hidden>
                  {!none && (
                    <span
                      className="rp-grow absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${(r.perAudit / max) * 100}%`, background: 'var(--tone-dot)', ['--d' as string]: `${300 + k * 45}ms` }}
                    />
                  )}
                </span>
                <span className="num flex min-w-[8ch] items-baseline justify-end gap-1.5 text-[12px]">
                  <span data-testid="positives-contractor-rate" className={`font-semibold ${none ? '' : 'text-ink'}`}>{r.perAudit.toFixed(1)}</span>
                  <span className="text-muted">({r.count})</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Notes({ notes }: { notes: PositiveNote[] }) {
  return (
    <section data-testid="positives-notes" aria-labelledby="positives-notes-h" className="card flex min-h-0 flex-col py-[clamp(10px,1.5svh,20px)]">
      <div className="flex shrink-0 items-baseline justify-between gap-3 px-[clamp(14px,1.3vw,24px)] pb-[clamp(6px,1svh,12px)]">
        <h2 id="positives-notes-h" className="text-[clamp(14px,1.7svh,17px)] font-semibold tracking-[-0.01em]">Good practice</h2>
        <span className="text-[11px] leading-none text-muted">newest first</span>
      </div>
      <ul className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-[clamp(8px,0.8vw,16px)]">
        {notes.map((n) => (
          <li key={n.id} className="border-b border-hairline last:border-b-0">
            <Link
              href={n.href}
              data-testid="positives-note"
              className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5 rounded-[8px] px-1.5 py-[clamp(6px,1svh,10px)] transition-colors hover:bg-fill-2"
            >
              <ThumbsUp size={14} strokeWidth={2.4} className="mt-[3px] text-[var(--tone-dot)]" aria-hidden />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-[clamp(13px,1.6svh,14.5px)] leading-snug">{n.text}</span>
                <span className="flex flex-wrap items-center gap-x-2 text-[12px] leading-none text-muted">
                  <span className="font-semibold text-ink">{n.contractor}</span>
                  <span>{n.date}</span>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
