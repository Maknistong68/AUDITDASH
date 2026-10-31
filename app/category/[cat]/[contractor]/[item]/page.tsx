import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRepo } from '@/lib/data/repo';
import { auditItemStates, itemTimeline, type ItemState } from '@/lib/analytics';
import { categoryById } from '@/lib/categories';
import { detailContext, href, type SP } from '@/lib/details';
import { dateLabel } from '@/lib/format';
import { findCategory, findContractor, findItem } from '@/lib/routeParams';
import { BentoCard, TileLabel } from '@/components/bento/BentoGrid';
import { HandoffLanding, HandoffLink } from '@/components/motion/HandoffLink';
import { DRILL_ITEM, DRILL_NOTE } from '@/lib/handoff';
import { DetailFrame } from '@/components/details/DetailFrame';
import { CategoryChip, StatePill } from '@/components/details/parts';
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
  const repo = await getRepo();
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

        {/* The cards fill the screen under the title. */}
        <div className="grid grid-cols-1 gap-[var(--gap-grid)] min-[1200px]:min-h-0 min-[1200px]:flex-1 min-[1200px]:[&>*]:min-h-0 min-[1200px]:grid-cols-12 min-[1200px]:grid-rows-[minmax(0,1fr)]">
          <BentoCard i={0} testid="item-timeline" landing={DRILL_ITEM} className="gap-[clamp(8px,1.4svh,12px)] px-[clamp(14px,1.4vw,24px)] py-[clamp(12px,1.8svh,24px)] min-[1200px]:col-span-4">
            <TileLabel>History</TileLabel>
            {entries.length === 0 ? (
              <p className="text-[15px] text-muted">No audits match this filter.</p>
            ) : (
              <ol className="relative grid min-h-0 content-start gap-[clamp(10px,2svh,24px)] overflow-y-auto overscroll-contain">
                {entries.map(({ audit, observation, state }, i) => (
                  <li key={audit.id} data-testid="timeline-entry" data-state={state} data-handoff-card="" data-handoff={DRILL_NOTE} className="relative grid grid-cols-[18px_minmax(0,1fr)] gap-x-3 rounded-[12px]">
                    <span aria-hidden className="relative flex justify-center">
                      <span className="mt-[5px] size-3 rounded-full" style={{ background: DOT[state] }} />
                      {i < entries.length - 1 && <span className="absolute bottom-[calc(-1*clamp(10px,2svh,24px))] top-[22px] w-[2px] rounded-full bg-fill" />}
                    </span>
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[14px]">
                        <span className="font-semibold">{dateLabel(audit.date)}</span>
                        <StatePill state={state} />
                      </div>
                      {observation ? (
                        <>
                          <p className="line-clamp-3 whitespace-pre-line break-words text-[14px] leading-snug [@media(min-height:900px)]:line-clamp-5" title={observation.text}>{observation.text}</p>
                          <HandoffLink
                            data-testid="observation-link"
                            href={href(`/category/${cat}/${contractor.id}/${encodeURIComponent(item.code)}/${observation.id}`, query)}
                            className="inline-flex w-fit items-center gap-1 rounded-full py-0.5 text-[14px] font-semibold text-[var(--accent)] hover:underline"
                          >
                            Read
                          </HandoffLink>
                        </>
                      ) : (
                        <p className="text-[14px] text-muted">{state === 'na' ? 'N/A' : '—'}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </BentoCard>

          <BentoCard i={1} testid="item-summary" className="justify-center gap-[clamp(8px,1.8svh,28px)] overflow-hidden p-[clamp(14px,2svh,26px)] min-[1200px]:col-span-3">
            <TileLabel>Noted</TileLabel>
            <p className="figure text-[clamp(44px,9svh,120px)]" data-testid="noted-count">
              {n('noted')}
              <span className="ml-2 text-[0.3em] font-semibold tracking-normal text-muted">/ {entries.length - n('na')}</span>
            </p>
            {/* One dot per audit, oldest to newest: filled = noted, ring = clear, faint = not applicable. */}
            <ol className="flex flex-wrap gap-3" data-testid="item-dots" aria-label={entries.map((e) => `${dateLabel(e.audit.date)} ${e.state}`).join(', ')}>
              {[...entries].reverse().map(({ audit, state }) => (
                <li key={audit.id} className="flex flex-col items-center gap-1.5" data-state={state}>
                  <span
                    className="size-6 rounded-full"
                    style={
                      state === 'noted'
                        ? { background: 'var(--gap)' }
                        : state === 'none'
                          ? { boxShadow: 'inset 0 0 0 2.5px var(--good-dot)' }
                          : { background: 'var(--fill)' }
                    }
                  />
                  <span className="text-[12px] text-muted">{dateLabel(audit.date, false)}</span>
                </li>
              ))}
            </ol>
          </BentoCard>

          {siblings.length > 1 && (
            <BentoCard i={2} testid="sibling-items" className="gap-1.5 px-[clamp(10px,1vw,18px)] py-[clamp(12px,1.8svh,24px)] min-[1200px]:col-span-5">
              <TileLabel className="px-[clamp(6px,0.6vw,10px)]">{c.short}</TileLabel>
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
                      data-state={r.state}
                      title={r.state === 'noted' ? 'Noted in the latest audit' : r.state === 'na' ? 'N/A' : 'Clear'}
                      className={`grid grid-cols-[10px_minmax(0,1fr)] items-center gap-3 rounded-[12px] px-[clamp(6px,0.6vw,10px)] py-[clamp(4px,0.9svh,9px)] transition-colors hover:bg-fill-2 ${current ? 'bg-fill-2' : ''}`}
                    >
                      <span
                        aria-hidden
                        className="size-2.5 rounded-full"
                        style={{ background: r.state === 'noted' ? 'var(--gap)' : r.state === 'none' ? 'var(--good-dot)' : 'var(--fill)' }}
                      />
                      <span className={`truncate text-[14px] ${current ? 'font-semibold' : ''}`}>{name}</span>
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
