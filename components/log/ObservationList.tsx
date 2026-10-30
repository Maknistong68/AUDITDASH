'use client';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useState } from 'react';
import { dateLabel } from '@/lib/format';
import { obsHref, type LogAudit, type LogObs } from '@/lib/log';
import { CategoryTag, Highlight, KindPill, LogEmpty, OpenHint } from './parts';
import { usePaged, useRowMotion } from './useRows';

const GRID = 'min-[1000px]:grid-cols-[minmax(0,13rem)_6.5rem_minmax(0,15rem)_minmax(0,1fr)_4.5rem]';

/**
 * One row per observation: contractor and date, kind, category and question, the note (two lines, click to expand,
 * search terms marked), and "Open →" to its own page (or its audit report). Rendered a page at a time.
 */
export function ObservationList({ rows, terms, questions, linkQuery, resetKey, onClear }: {
  rows: { obs: LogObs; audit: LogAudit }[];
  terms: string[];
  questions: Record<string, string>;
  linkQuery: string;
  resetKey: string;
  onClear: () => void;
}) {
  const { shown, more, sentinel } = usePaged(rows.length, resetKey);
  const motionOf = useRowMotion();
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) => setOpen((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  return (
    <section data-testid="log-observations" aria-label="Observations" className="card overflow-hidden py-1.5">
      {rows.length > 0 && (
        <div className={`hidden ${GRID} gap-x-4 border-b border-hairline px-[clamp(14px,1.3vw,24px)] pb-2 pt-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint min-[1000px]:grid`} aria-hidden>
          <span>Contractor · date</span><span>Kind</span><span>Question</span><span>Note</span><span />
        </div>
      )}
      {rows.length === 0 ? (
        <LogEmpty onClear={onClear} />
      ) : (
        <ul className="flex flex-col px-[clamp(4px,0.5vw,10px)]">
          <AnimatePresence initial mode="popLayout">
            {rows.slice(0, shown).map(({ obs, audit }, i) => {
              const expanded = open.has(obs.id);
              const href = obsHref(obs, audit, linkQuery);
              return (
                <motion.li
                  key={obs.id}
                  layout="position"
                  {...motionOf(i)}
                  data-testid="log-obs"
                  data-kind={obs.kind}
                  className="group relative border-b border-hairline last:border-b-0"
                >
                  <div className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 rounded-[12px] px-[clamp(10px,0.9vw,16px)] py-3 transition-colors duration-300 group-hover:bg-fill-2 ${GRID} min-[1000px]:items-start min-[1000px]:gap-x-4`}>
                    {/* contractor · date */}
                    <div className="col-span-2 flex min-w-0 items-center gap-2 min-[1000px]:col-span-1 min-[1000px]:flex-col min-[1000px]:items-start min-[1000px]:gap-0.5">
                      <span className="shrink-0 min-[1000px]:hidden"><KindPill kind={obs.kind} /></span>
                      <span className="min-w-0 truncate text-[14px] font-semibold min-[1000px]:order-first min-[1000px]:w-full" title={audit.contractor}>
                        <Highlight text={audit.contractor} terms={terms} />
                      </span>
                      <span className="num ml-auto shrink-0 whitespace-nowrap text-[12.5px] text-muted min-[1000px]:ml-0">{dateLabel(audit.date)}</span>
                    </div>
                    {/* kind (desktop column) */}
                    <div className="hidden pt-[1px] min-[1000px]:block"><KindPill kind={obs.kind} /></div>
                    {/* category · question */}
                    <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] min-[1000px]:col-span-1 min-[1000px]:flex-col min-[1000px]:items-start">
                      {obs.category ? <CategoryTag id={obs.category} className="font-semibold" /> : <span className="text-faint">General</span>}
                      {obs.label && (
                        <span className="min-w-0 truncate text-muted min-[1000px]:w-full" title={obs.itemCode ? `${obs.itemCode} · ${questions[obs.itemCode] ?? obs.label}` : undefined}>
                          <span className="num mr-1 rounded-[5px] bg-fill px-1 py-[1px] text-[11px] font-semibold"><Highlight text={obs.itemCode ?? ''} terms={terms} /></span>
                          <Highlight text={obs.label} terms={terms} />
                        </span>
                      )}
                    </div>
                    {/* the note */}
                    <button
                      type="button"
                      onClick={() => toggle(obs.id)}
                      aria-expanded={expanded}
                      data-testid="log-obs-text"
                      className={`col-span-2 min-w-0 cursor-pointer text-left text-[14px] leading-[1.45] min-[1000px]:col-span-1 ${expanded ? '' : 'line-clamp-2'}`}
                    >
                      <Highlight text={obs.text || '—'} terms={terms} />
                    </button>
                    <Link
                      href={href}
                      data-testid="log-obs-open"
                      aria-label={`Open ${obs.drill ? 'observation' : 'audit report'}: ${audit.contractor}, ${dateLabel(audit.date)}`}
                      className="col-span-2 flex justify-end rounded-full min-[1000px]:col-span-1 min-[1000px]:pt-[1px]"
                    >
                      <OpenHint />
                    </Link>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
      {shown < rows.length && (
        <div ref={sentinel} className="flex justify-center px-4 pb-3 pt-2">
          <button type="button" onClick={more} className="h-9 rounded-full bg-fill-2 px-4 text-[13px] font-semibold text-ink transition-colors hover:bg-fill">
            Show more <span className="num text-muted">· {rows.length - shown} left</span>
          </button>
        </div>
      )}
    </section>
  );
}
