import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { getRepo } from '@/lib/data/repo';
import { auditItemStates, contractorAudits, itemHistory, type ItemState } from '@/lib/analytics';
import { categoryById } from '@/lib/categories';
import { detailContext, href, type SP } from '@/lib/details';
import { dateLabel, quarterLabel } from '@/lib/format';
import { findCategory, findContractor, findItem } from '@/lib/routeParams';
import { BentoCard, TileLabel } from '@/components/bento/BentoGrid';
import { DetailFrame } from '@/components/details/DetailFrame';
import { CategoryChip, CodeChip, StatePill } from '@/components/details/parts';

type Params = { cat: string; contractor: string; item: string };

const DOT: Record<ItemState | 'positive', string> = {
  finding: 'var(--non-dot)', clear: 'var(--good-dot)', na: 'var(--control)', positive: 'var(--good-dot)',
};

/** One checklist item across the contractor's audits: a vertical timeline, newest first. */
export default async function ItemPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<SP> }) {
  const p = await params;
  const repo = getRepo();
  const cat = findCategory(p.cat);
  const contractor = findContractor(repo, p.contractor);
  const item = cat ? findItem(repo, cat, p.item) : null;
  if (!cat || !contractor || !item) notFound();
  const { filter, query } = detailContext(await searchParams);
  const c = categoryById(cat);
  const naCodes = (a: { sections: { code: string; possible: number }[] }) => new Set(a.sections.filter((s) => s.possible === 0).map((s) => s.code));
  const entries = itemHistory(repo, contractor.id, item.code)
    .filter(() => filter.regions.includes(contractor.subregion))
    .map(({ audit, observation }) => {
      const na = naCodes(audit).has(item.subsection ?? item.section);
      const state: ItemState = na ? 'na' : observation && observation.kind !== 'positive' ? 'finding' : 'clear';
      return { audit, observation, state };
    })
    .reverse();
  const parent = href(`/category/${cat}/${contractor.id}`, query);
  const crumbs = [
    { label: 'Overview', href: `/?${query}` },
    { label: c.name, href: href(`/category/${cat}`, query) },
    { label: contractor.name, href: parent },
    { label: item.code },
  ];
  // The category's other items, as they stood in the contractor's latest audit (within the filter).
  const latest = filter.regions.includes(contractor.subregion) ? contractorAudits(repo, filter, contractor.id)[0]?.audit : undefined;
  const siblings = latest ? auditItemStates(repo, latest, cat) : [];
  const sectionCode = item.subsection ?? item.section;
  const n = (s: ItemState) => entries.filter((e) => e.state === s).length;

  return (
    <DetailFrame filter={filter} crumbs={crumbs} parent={parent}>
      <div className="grid grid-cols-1 gap-[var(--gap-grid)] px-[var(--gutter)] min-[1100px]:grid-cols-12">
        <header className="flex min-w-0 flex-col gap-2 pb-1 min-[1100px]:col-span-12">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-[24px] min-[900px]:text-[clamp(24px,3.6svh,32px)] font-semibold leading-[1.05] tracking-[-0.035em]">Item {item.code}</h1>
            <CategoryChip id={cat} />
            <span className="text-[14px] text-muted">{contractor.name}</span>
          </div>
          <p className="max-w-[64ch] text-[clamp(17px,2.4svh,22px)] font-semibold leading-[1.3] tracking-[-0.018em]">{item.question}</p>
        </header>

        <BentoCard i={0} testid="item-timeline" className="gap-3 px-[clamp(14px,1.4vw,24px)] py-[clamp(14px,2svh,24px)] min-[1100px]:col-span-8">
          <TileLabel>History · newest first</TileLabel>
          {entries.length === 0 ? (
            <p className="text-[15px] text-muted">No audits match this filter.</p>
          ) : (
            <ol className="relative grid gap-[clamp(14px,2.2svh,24px)]">
              {entries.map(({ audit, observation, state }, i) => (
                <li key={audit.id} data-testid="timeline-entry" data-state={state} className="relative grid grid-cols-[18px_minmax(0,1fr)] gap-x-4">
                  <span aria-hidden className="relative flex justify-center">
                    <span className="mt-[5px] size-3 rounded-full" style={{ background: DOT[state] }} />
                    {i < entries.length - 1 && <span className="absolute bottom-[-24px] top-[22px] w-[2px] rounded-full bg-fill" />}
                  </span>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px]">
                      <span className="font-semibold">{dateLabel(audit.date)}</span>
                      <span className="text-muted">· {quarterLabel(audit.quarter)} · Inspection {audit.inspectionNo}</span>
                      <StatePill state={state} />
                    </div>
                    {observation && state !== 'na' ? (
                      <>
                        <p className="line-clamp-4 whitespace-pre-line break-words text-[15px] leading-relaxed">{observation.text}</p>
                        <Link
                          data-testid="observation-link"
                          href={href(`/category/${cat}/${contractor.id}/${encodeURIComponent(item.code)}/${observation.id}`, query)}
                          className="inline-flex w-fit items-center gap-1 rounded-full py-0.5 text-[14px] font-semibold text-[var(--accent)] hover:underline"
                        >
                          Read observation <ArrowRight size={14} strokeWidth={2.4} aria-hidden />
                        </Link>
                      </>
                    ) : (
                      <p className="text-[14px] text-muted">{state === 'na' ? 'Not applicable in this audit.' : 'No finding recorded.'}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </BentoCard>

        <BentoCard i={1} testid="item-summary" className="justify-between gap-4 p-[clamp(16px,2.2svh,26px)] min-[1100px]:col-span-4">
          <div className="flex flex-col gap-4">
          <TileLabel>Across {entries.length} {entries.length === 1 ? 'audit' : 'audits'}</TileLabel>
          <p className="figure text-[clamp(56px,9svh,96px)]">
            {n('finding')}
            <span className="ml-2 text-[0.3em] font-semibold tracking-normal text-muted">of {entries.length - n('na')} failed</span>
          </p>
          <div className="flex flex-col gap-1.5" data-testid="section-history">
            <p className="text-[13px] text-muted">Section {sectionCode} score per audit · item weight {item.weight}</p>
            <ul className="grid gap-1.5">
              {entries.map(({ audit }) => {
                const sec = audit.sections.find((x) => x.code === sectionCode);
                const v = sec && sec.possible > 0 ? sec.scored / sec.possible : null;
                return (
                  <li key={audit.id} className="grid grid-cols-[6.2em_minmax(0,1fr)_3ch] items-center gap-2.5 text-[13px]">
                    <span className="text-muted">{dateLabel(audit.date)}</span>
                    <span className="relative block h-[7px] overflow-hidden rounded-full bg-fill-2" aria-hidden>
                      {v !== null && <span className="absolute inset-y-0 left-0 rounded-full bg-[var(--bar)]" style={{ width: `${v * 100}%` }} />}
                    </span>
                    <span className="num text-right font-semibold">{v === null ? 'N/A' : Math.round(v * 100)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center">
            {(['finding', 'clear', 'na'] as ItemState[]).map((s) => (
              <div key={s} className="flex flex-col items-center gap-1">
                <dt><StatePill state={s} /></dt>
                <dd className="num text-[22px] font-semibold">{n(s)}</dd>
              </div>
            ))}
          </dl>
        </BentoCard>

        {siblings.length > 1 && (
          <BentoCard i={2} testid="sibling-items" className="gap-2 px-[clamp(10px,1vw,18px)] py-[clamp(14px,2svh,24px)] min-[1100px]:col-span-12">
            <TileLabel className="px-[clamp(6px,0.6vw,10px)]">{c.short} items · latest audit {latest ? dateLabel(latest.date) : ''}</TileLabel>
            <ul
              className="grid grid-cols-1 gap-x-[clamp(16px,2vw,40px)] min-[1100px]:grid-flow-col min-[1100px]:grid-cols-2 min-[1100px]:[grid-template-rows:repeat(var(--rows),auto)]"
              style={{ '--rows': Math.ceil(siblings.length / 2) } as React.CSSProperties}
            >
              {siblings.map((r) => {
                const current = r.item.code === item.code;
                return (
                  <li key={r.item.code}>
                    <Link
                      href={href(`/category/${cat}/${contractor.id}/${encodeURIComponent(r.item.code)}`, query)}
                      aria-current={current ? 'page' : undefined}
                      className={`grid grid-cols-[3.4em_minmax(0,1fr)_auto] items-center gap-3 rounded-[12px] px-[clamp(6px,0.6vw,10px)] py-[clamp(6px,1svh,9px)] transition-colors hover:bg-fill-2 ${current ? 'bg-fill-2' : ''}`}
                    >
                      <CodeChip code={r.item.code} />
                      <span className={`truncate text-[14px] ${current ? 'font-semibold' : ''}`} title={r.item.question}>{r.item.question}</span>
                      <StatePill state={r.state} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </BentoCard>
        )}
      </div>
    </DetailFrame>
  );
}
