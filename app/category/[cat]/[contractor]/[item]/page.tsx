import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { getRepo } from '@/lib/data/repo';
import { auditItemStates, itemTimeline, type ItemState } from '@/lib/analytics';
import { categoryById } from '@/lib/categories';
import { detailContext, href, type SP } from '@/lib/details';
import { dateLabel, quarterLabel } from '@/lib/format';
import { findCategory, findContractor, findItem } from '@/lib/routeParams';
import { BentoCard, TileLabel } from '@/components/bento/BentoGrid';
import { HandoffLanding, HandoffLink } from '@/components/motion/HandoffLink';
import { DRILL_ITEM, DRILL_NOTE } from '@/lib/handoff';
import { DetailFrame } from '@/components/details/DetailFrame';
import { CategoryChip, SectionGap, StatePill } from '@/components/details/parts';
import { FitList } from '@/components/details/FitList';
import { itemLabel } from '@/lib/itemLabels';

type Params = { cat: string; contractor: string; item: string };

/** Neutral rail dots: a note is not a verdict (severity is the section gap beside each entry). */
const DOT: Record<ItemState, string> = { noted: 'var(--text)', none: 'var(--faint)', na: 'var(--control)' };

/**
 * One checklist item across the contractor's audits, one screen from 1200px (DetailFrame `fit`): the plain label as the
 * title with the full audit question as one muted line under it (the deepest level before the observation), then three
 * cards side by side: the history (newest first), how often it was noted with its section score per audit, and the
 * category's other items in the latest audit (plain labels; the top that fit, then "+N more"). Narrower, they stack.
 */
export default async function ItemPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<SP> }) {
  const p = await params;
  const repo = getRepo();
  const cat = findCategory(p.cat);
  const contractor = findContractor(repo, p.contractor);
  const item = cat ? findItem(repo, cat, p.item) : null;
  if (!cat || !contractor || !item) notFound();
  const { filter, query } = detailContext(await searchParams);
  const c = categoryById(cat);
  const entries = itemTimeline(repo, filter, contractor.id, item);
  const parent = href(`/category/${cat}/${contractor.id}`, query);
  const label = itemLabel(item.code, item.question);
  const crumbs = [
    { label: 'Overview', href: `/?${query}` },
    { label: c.name, href: href(`/category/${cat}`, query) },
    { label: contractor.name, href: parent },
    { label },
  ];
  // The category's other items, as they stood in the contractor's latest audit (within the filter).
  const latest = entries[0]?.audit;
  const siblings = latest ? auditItemStates(repo, latest, cat) : [];
  const sectionCode = item.subsection ?? item.section;
  const n = (s: ItemState) => entries.filter((e) => e.state === s).length;

  return (
    <DetailFrame filter={filter} crumbs={crumbs} parent={parent} fit>
      <div className="flex flex-col gap-[var(--gap-grid)] px-[var(--gutter)] min-[1200px]:min-h-0 min-[1200px]:flex-1">
        <HandoffLanding />
        <header className="flex min-w-0 shrink-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 data-testid="item-title" className="text-[24px] min-[900px]:text-[clamp(24px,3.6svh,32px)] font-semibold leading-[1.05] tracking-[-0.035em]">{label}</h1>
            <CategoryChip id={cat} />
            <span className="text-[14px] text-muted">{contractor.name}</span>
          </div>
          <p data-testid="item-question" className="line-clamp-2 max-w-[110ch] text-[clamp(13px,1.6svh,15px)] leading-snug text-muted" title={item.question}>{item.question}</p>
        </header>

        {/* Cards as tall as the tallest one's content, capped at the screen (flex-initial shrinks, never grows). */}
        <div className="grid grid-cols-1 gap-[var(--gap-grid)] min-[1200px]:min-h-0 min-[1200px]:flex-initial min-[1200px]:grid-cols-12 min-[1200px]:grid-rows-[minmax(0,1fr)]">
          <BentoCard i={0} testid="item-timeline" landing={DRILL_ITEM} className="gap-[clamp(8px,1.4svh,12px)] px-[clamp(14px,1.4vw,24px)] py-[clamp(12px,1.8svh,24px)] min-[1200px]:col-span-4">
            <TileLabel>History · newest first</TileLabel>
            {entries.length === 0 ? (
              <p className="text-[15px] text-muted">No audits match this filter.</p>
            ) : (
              <ol className="relative grid min-h-0 content-start gap-[clamp(10px,2svh,24px)] overflow-y-auto overscroll-contain">
                {entries.map(({ audit, observation, state, ratio }, i) => (
                  <li key={audit.id} data-testid="timeline-entry" data-state={state} data-handoff-card="" data-handoff={DRILL_NOTE} className="relative grid grid-cols-[18px_minmax(0,1fr)] gap-x-3 rounded-[12px]">
                    <span aria-hidden className="relative flex justify-center">
                      <span className="mt-[5px] size-3 rounded-full" style={{ background: DOT[state] }} />
                      {i < entries.length - 1 && <span className="absolute bottom-[calc(-1*clamp(10px,2svh,24px))] top-[22px] w-[2px] rounded-full bg-fill" />}
                    </span>
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px]">
                        <span className="font-semibold">{dateLabel(audit.date)}</span>
                        <span className="text-muted">· {quarterLabel(audit.quarter)} · Inspection {audit.inspectionNo}</span>
                        <StatePill state={state} />
                        <span className="w-[min(12em,40vw)]"><SectionGap ratio={ratio} /></span>
                      </div>
                      {observation ? (
                        <>
                          <p className="line-clamp-3 whitespace-pre-line break-words text-[14px] leading-snug [@media(min-height:900px)]:line-clamp-5" title={observation.text}>{observation.text}</p>
                          <HandoffLink
                            data-testid="observation-link"
                            href={href(`/category/${cat}/${contractor.id}/${encodeURIComponent(item.code)}/${observation.id}`, query)}
                            className="inline-flex w-fit items-center gap-1 rounded-full py-0.5 text-[14px] font-semibold text-[var(--accent)] hover:underline"
                          >
                            Read observation <ArrowRight size={14} strokeWidth={2.4} aria-hidden />
                          </HandoffLink>
                        </>
                      ) : (
                        <p className="text-[14px] text-muted">{state === 'na' ? 'Not applicable in this audit.' : 'No auditor note on this item.'}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </BentoCard>

          <BentoCard i={1} testid="item-summary" className="justify-between gap-[clamp(8px,1.6svh,16px)] p-[clamp(14px,2svh,26px)] min-[1200px]:col-span-3">
            <div className="flex min-h-0 flex-col gap-[clamp(6px,1.4svh,16px)]">
              <TileLabel>Noted in</TileLabel>
              <p className="figure text-[clamp(48px,8svh,96px)]" data-testid="noted-count">
                {n('noted')}
                <span className="ml-2 text-[0.3em] font-semibold tracking-normal text-muted">of {entries.length - n('na')} {entries.length - n('na') === 1 ? 'audit' : 'audits'}</span>
              </p>
              <div className="flex flex-col gap-1.5" data-testid="section-history">
                <p className="text-[13px] text-muted">Section score per audit · item weight {item.weight}</p>
                <ul className="grid gap-1.5">
                  {entries.map(({ audit }) => {
                    const sec = audit.sections.find((x) => x.code === sectionCode);
                    const v = sec && sec.possible > 0 ? sec.scored / sec.possible : null;
                    return (
                      <li key={audit.id} className="grid grid-cols-[6.2em_minmax(0,1fr)_3.4ch] items-center gap-2.5 text-[13px]">
                        <span className="text-muted">{dateLabel(audit.date)}</span>
                        <span className="relative block h-[7px] overflow-hidden rounded-full bg-fill-2" aria-hidden>
                          {v !== null && <span className="absolute inset-y-0 left-0 rounded-full bg-[var(--bar)]" style={{ width: `${v * 100}%` }} />}
                        </span>
                        <span className="num text-right font-semibold">{v === null ? 'N/A' : `${Math.round(v * 100)}%`}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center">
              {(['noted', 'none', 'na'] as ItemState[]).map((s) => (
                <div key={s} className="flex flex-col items-center gap-1">
                  <dt><StatePill state={s} /></dt>
                  <dd className="num text-[22px] font-semibold">{n(s)}</dd>
                </div>
              ))}
            </dl>
          </BentoCard>

          {siblings.length > 1 && (
            <BentoCard i={2} testid="sibling-items" className="gap-1.5 px-[clamp(10px,1vw,18px)] py-[clamp(12px,1.8svh,24px)] min-[1200px]:col-span-5">
              <TileLabel className="px-[clamp(6px,0.6vw,10px)]">{c.short} items · latest audit {latest ? dateLabel(latest.date) : ''}</TileLabel>
              <FitList testid="sibling-list" label="items" className="grid content-start">
                {siblings.map((r) => {
                  const current = r.item.code === item.code;
                  const name = itemLabel(r.item.code, r.item.question);
                  return (
                    <Link
                      key={r.item.code}
                      data-testid="sibling-item"
                      href={href(`/category/${cat}/${contractor.id}/${encodeURIComponent(r.item.code)}`, query)}
                      aria-current={current ? 'page' : undefined}
                      className={`grid grid-cols-[minmax(0,1fr)_5.5em_auto] items-center gap-3 rounded-[12px] px-[clamp(6px,0.6vw,10px)] py-[clamp(4px,0.9svh,9px)] transition-colors hover:bg-fill-2 ${current ? 'bg-fill-2' : ''}`}
                    >
                      <span className={`truncate text-[14px] ${current ? 'font-semibold' : ''}`} title={name}>{name}</span>
                      <SectionGap ratio={r.ratio} />
                      <StatePill state={r.state} />
                    </Link>
                  );
                })}
              </FitList>
            </BentoCard>
          )}
        </div>
      </div>
    </DetailFrame>
  );
}
