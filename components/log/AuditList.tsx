'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { Info, ThumbsUp } from 'lucide-react';
import Link from 'next/link';
import { bandShort, bandTone, dateLabel, pct, quarterLabel } from '@/lib/format';
import { excelDiffers, type LogAudit } from '@/lib/log';
import { bandFor } from '@/lib/scoring';
import { Highlight, LogEmpty, OpenHint } from './parts';
import { usePaged, useRowMotion } from './useRows';

const GRID =
  'min-[1100px]:grid-cols-[7.5rem_minmax(0,1.3fr)_minmax(0,1fr)_10rem_6.5rem_4rem_9.5rem]';

/**
 * One row per audit: date and quarter, contractor (region, inspection no.), auditors, the honest score (band colour,
 * thin bar), findings (bar against the most in view), positives, and a small neutral data-check flag when the Excel's
 * typed total or points did not add up (hover lists the checks). The row opens the audit report.
 */
export function AuditList({ rows, terms, linkQuery, resetKey, onClear }: {
  rows: LogAudit[]; terms: string[]; linkQuery: string; resetKey: string; onClear: () => void;
}) {
  const { shown, more, sentinel } = usePaged(rows.length, resetKey);
  const motionOf = useRowMotion();
  const maxFindings = Math.max(1, ...rows.map((r) => r.findings));

  return (
    <section data-testid="log-audits" aria-label="Audits" className="card py-1.5">
      {rows.length > 0 && (
        <div className={`hidden ${GRID} gap-x-4 border-b border-hairline px-[clamp(14px,1.3vw,24px)] pb-2 pt-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint min-[1100px]:grid`} aria-hidden>
          <span>Date</span><span>Contractor</span><span>Auditors</span><span>Score</span><span>Findings</span><span>Positives</span><span />
        </div>
      )}
      {rows.length === 0 ? (
        <LogEmpty onClear={onClear} />
      ) : (
        <ul className="flex flex-col px-[clamp(4px,0.5vw,10px)]">
          <AnimatePresence initial mode="popLayout">
            {rows.slice(0, shown).map((a, i) => {
              const band = bandFor(a.score);
              return (
                <motion.li key={a.id} layout="position" {...motionOf(i)} className="group border-b border-hairline last:border-b-0">
                  <Link
                    href={`/audit/${encodeURIComponent(a.id)}${linkQuery ? `?${linkQuery}` : ''}`}
                    data-testid="log-audit"
                    data-id={a.id}
                    className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-[12px] px-[clamp(10px,0.9vw,16px)] py-3 transition-colors duration-300 hover:bg-fill-2 ${GRID}`}
                  >
                    {/* date · quarter */}
                    <span className="order-2 col-span-2 flex flex-wrap items-baseline gap-x-2 text-[12.5px] text-muted min-[1100px]:order-none min-[1100px]:col-span-1 min-[1100px]:flex-col min-[1100px]:gap-0">
                      <span className="num font-semibold text-ink min-[1100px]:text-[14px]">{dateLabel(a.date)}</span>
                      <span>{quarterLabel(a.quarter)}</span>
                      <span className="min-[1100px]:hidden">· {a.region} · <Highlight text={a.inspectionNo} terms={terms} /></span>
                    </span>
                    {/* contractor */}
                    <span className="order-1 flex min-w-0 flex-col min-[1100px]:order-none">
                      <span className="truncate text-[15px] font-semibold" title={a.contractor}><Highlight text={a.contractor} terms={terms} /></span>
                      <span className="hidden truncate text-[12.5px] text-muted min-[1100px]:block">
                        {a.region} · <Highlight text={a.inspectionNo} terms={terms} />
                      </span>
                    </span>
                    {/* auditors */}
                    <span className="order-3 col-span-2 min-w-0 truncate text-[13px] text-muted min-[1100px]:order-none min-[1100px]:col-span-1" title={a.auditors.join(', ')}>
                      <Highlight text={a.auditors.join(', ')} terms={terms} />
                    </span>
                    {/* score */}
                    <span className={`tone-${bandTone(band)} order-1 flex min-w-[6.5rem] flex-col items-end gap-1 min-[1100px]:order-none min-[1100px]:items-stretch`} data-testid="log-audit-score">
                      <span className="flex items-baseline justify-end gap-2 min-[1100px]:justify-between">
                        <span className="num text-[20px] font-semibold leading-none tracking-[-0.02em] min-[1100px]:text-[17px]">
                          {pct(a.score)}<span className="text-[0.6em] text-muted">%</span>
                        </span>
                        <span className="text-[12px] font-semibold" style={{ color: 'var(--tone)' }}>{bandShort(band)}</span>
                      </span>
                      <span className="relative hidden h-[5px] w-full overflow-hidden rounded-full bg-fill-2 min-[1100px]:block" aria-hidden>
                        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(1, Math.max(0, a.score)) * 100}%`, background: 'var(--tone-dot)' }} />
                      </span>
                    </span>
                    {/* findings · positives · flag (one line on phones) */}
                    <span className="order-4 col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 min-[1100px]:contents">
                      <span className="flex items-center gap-2 text-[13px]" data-testid="log-audit-findings" title={`${a.findings} findings`}>
                        <span className="num min-w-[2ch] font-semibold">{a.findings}</span>
                        <span className="relative h-[5px] w-12 overflow-hidden rounded-full bg-fill-2" aria-hidden>
                          <span className="absolute inset-y-0 left-0 rounded-full bg-[var(--gap)]" style={{ width: `${(a.findings / maxFindings) * 100}%` }} />
                        </span>
                        <span className="text-muted min-[1100px]:sr-only">findings</span>
                      </span>
                      <span className="tone-good flex items-center gap-1.5 text-[13px]" data-testid="log-audit-positives" title={`${a.positives} positive observations`}>
                        <ThumbsUp size={13} strokeWidth={2.4} style={{ color: 'var(--tone-dot)' }} aria-hidden />
                        <span className="num font-semibold">{a.positives}</span>
                        <span className="sr-only">positive</span>
                      </span>
                      <span className="ml-auto flex items-center justify-end gap-3 min-[1100px]:ml-0">
                        {excelDiffers(a) && <DataCheck audit={a} />}
                        <span className="hidden min-[1100px]:contents"><OpenHint /></span>
                      </span>
                    </span>
                  </Link>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
      {shown < rows.length && (
        <div ref={sentinel} className="flex justify-center px-4 pb-3 pt-2">
          <button type="button" onClick={more} className="h-9 rounded-full bg-fill-2 px-4 text-[13px] font-semibold text-ink transition-colors hover:bg-fill">Show more</button>
        </div>
      )}
    </section>
  );
}

/** Small neutral flag: the Excel's own total differs (or another import check); hover / focus lists the checks. */
function DataCheck({ audit }: { audit: LogAudit }) {
  const label = audit.reported !== null && Math.round(audit.reported * 100) !== Math.round(audit.score * 100)
    ? `Excel ${pct(audit.reported)}%`
    : 'Data check';
  return (
    <span className="group/flag relative inline-flex" data-testid="log-audit-flag">
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-fill-2 px-2 py-[2px] text-[11.5px] font-semibold text-muted">
        <Info size={12} strokeWidth={2.4} aria-hidden />
        {label}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+8px)] right-0 z-20 w-[min(300px,80vw)] translate-y-1 rounded-[12px] bg-surface-2 p-3 text-left text-[12.5px] leading-snug text-ink opacity-0 shadow-[var(--shadow-lift)] transition-[opacity,transform] duration-300 group-hover/flag:translate-y-0 group-hover/flag:opacity-100"
      >
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">Data check · score shown is recomputed</span>
        {audit.issues.map((x) => (
          <span key={x} className="block py-0.5">{x}</span>
        ))}
      </span>
    </span>
  );
}
