import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRepo } from '@/lib/data/repo';
import { isNaObservation, subsectionOf } from '@/lib/analytics';
import { categoryById } from '@/lib/categories';
import { detailContext, href, type SP } from '@/lib/details';
import { dateLabel } from '@/lib/format';
import { findCategory, findContractor, findItem, safeDecode } from '@/lib/routeParams';
import { BentoCard, TileLabel } from '@/components/bento/BentoGrid';
import { HandoffLanding } from '@/components/motion/HandoffLink';
import { DRILL_NOTE } from '@/lib/handoff';
import { DetailFrame } from '@/components/details/DetailFrame';
import { itemLabel } from '@/lib/itemLabels';
import { CategoryChip } from '@/components/details/parts';

type Params = { cat: string; contractor: string; item: string; obs: string };

/** The organisation's own terms; neutral styling (a note on an item is not a pass/fail verdict). */
const ANSWER = { full: 'Full', partial: 'Partial', no: 'No', na: 'N/A' } as const;

/** The observation in full: the only level with long text. */
export default async function ObservationPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<SP> }) {
  const p = await params;
  const repo = getRepo();
  const cat = findCategory(p.cat);
  const contractor = findContractor(repo, p.contractor);
  const item = cat ? findItem(repo, cat, p.item) : null;
  const obs = repo.observations().find((o) => o.id === safeDecode(p.obs));
  const audit = obs ? repo.audits().find((a) => a.id === obs.auditId) : undefined;
  if (!cat || !contractor || !item || !obs || !audit || obs.itemCode !== item.code || audit.contractorId !== contractor.id || isNaObservation(repo, obs)) {
    notFound();
  }
  const { filter, query } = detailContext(await searchParams);
  const c = categoryById(cat);
  const answer = audit.answers?.[item.code];
  const sub = subsectionOf(item.code);
  const sec = audit.sections.find((s) => s.code === sub);
  const itemHref = href(`/category/${cat}/${contractor.id}/${encodeURIComponent(item.code)}`, query);
  const crumbs = [
    { label: 'Overview', href: `/?${query}` },
    { label: c.name, href: href(`/category/${cat}`, query) },
    { label: contractor.name, href: href(`/category/${cat}/${contractor.id}`, query) },
    { label: itemLabel(item.code, item.question), href: itemHref },
    { label: `${dateLabel(audit.date)} observation` },
  ];

  return (
    <DetailFrame filter={filter} crumbs={crumbs} parent={itemHref} fit>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-[var(--gap-grid)] px-[var(--gutter)] min-[1100px]:grid-cols-12 min-[1100px]:grid-rows-[minmax(0,1fr)]">
        <HandoffLanding />
        <BentoCard i={0} testid="observation" landing={DRILL_NOTE} className="min-w-0 gap-[clamp(14px,2.2svh,24px)] overflow-y-auto p-[clamp(18px,2.6svh,36px)] min-[1100px]:col-span-8">
          <div className="flex flex-col gap-1.5">
            <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[22px] min-[900px]:text-[clamp(22px,3.2svh,30px)] font-semibold leading-[1.1] tracking-[-0.03em]">
              <span>{itemLabel(item.code, item.question)}</span>
            </h1>
            <p className="text-[14px] text-muted">{dateLabel(audit.date)}</p>
          </div>
          <p className="max-w-[60ch] text-[clamp(17px,2.2svh,20px)] font-semibold leading-[1.3] tracking-[-0.015em]">{item.question}</p>
          <p
            data-testid="observation-text"
            className="max-w-[72ch] whitespace-pre-line break-words text-[clamp(17px,2.3svh,21px)] leading-[1.6] [overflow-wrap:anywhere]"
          >
            {obs.text}
          </p>
          <Link
            href={href(`/audit/${audit.id}`, query)}
            className="mt-auto inline-flex h-10 w-fit items-center gap-1.5 rounded-full bg-ink px-5 text-[14px] font-semibold text-ground transition-transform active:scale-[0.97]"
          >
            Full report
          </Link>
        </BentoCard>

        <div className="flex min-w-0 flex-col gap-[var(--gap-grid)] min-[1100px]:col-span-4">
          <BentoCard i={1} testid="observation-score" className="gap-3 p-[clamp(16px,2.2svh,26px)]">
            <TileLabel>{answer ? 'Answer' : 'Section'}</TileLabel>
            {answer ? (
              <span className="text-[34px] font-semibold leading-none tracking-[-0.03em]">{ANSWER[answer]}</span>
            ) : sec && sec.possible > 0 ? (
              <>
                <span className="text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
                  {Math.round((sec.scored / sec.possible) * 100)}<span className="text-[18px] text-muted">%</span>
                </span>
                <div className="h-2 overflow-hidden rounded-full bg-fill" aria-hidden>
                  <div className="h-full rounded-full bg-[var(--bar)]" style={{ width: `${(sec.scored / sec.possible) * 100}%` }} />
                </div>
              </>
            ) : (
              <span className="text-[15px] text-muted">Not applicable</span>
            )}
          </BentoCard>
          <BentoCard i={2} testid="observation-meta" className="gap-4 p-[clamp(16px,2.2svh,26px)]">
            <CategoryChip id={cat} />
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[14px]">
              <dt className="text-muted">Contractor</dt>
              <dd className="font-semibold">{contractor.name}</dd>
              <dt className="text-muted">Region</dt>
              <dd>{audit.subregion}</dd>
              <dt className="text-muted">Location</dt>
              <dd className="break-words">{audit.location}</dd>
              <dt className="text-muted">Auditors</dt>
              <dd>{audit.auditors.join(', ')}</dd>
            </dl>
          </BentoCard>
        </div>
      </div>
    </DetailFrame>
  );
}
