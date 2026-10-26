import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Camera, ImageOff } from 'lucide-react';
import { getRepo } from '@/lib/data/repo';
import { isNaObservation } from '@/lib/analytics';
import { categoryById } from '@/lib/categories';
import { detailContext, href, type SP } from '@/lib/details';
import { dateLabel, quarterLabel } from '@/lib/format';
import { findCategory, findContractor, findItem, safeDecode } from '@/lib/routeParams';
import { BentoCard, TileLabel } from '@/components/bento/BentoGrid';
import { DetailFrame } from '@/components/details/DetailFrame';
import { CategoryChip } from '@/components/details/parts';

type Params = { cat: string; contractor: string; item: string; obs: string };

/** The organisation's own terms; neutral styling (a note on an item is not a pass/fail verdict). */
const KIND = { negative: 'Observation', site: 'Site observation', positive: 'Positive observation' } as const;

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
  const itemHref = href(`/category/${cat}/${contractor.id}/${encodeURIComponent(item.code)}`, query);
  const crumbs = [
    { label: 'Overview', href: `/?${query}` },
    { label: c.name, href: href(`/category/${cat}`, query) },
    { label: contractor.name, href: href(`/category/${cat}/${contractor.id}`, query) },
    { label: item.code, href: itemHref },
    { label: `${dateLabel(audit.date)} observation` },
  ];

  return (
    <DetailFrame filter={filter} crumbs={crumbs} parent={itemHref}>
      <div className="grid grid-cols-1 gap-[var(--gap-grid)] px-[var(--gutter)] min-[1100px]:grid-cols-12">
        <BentoCard i={0} testid="observation" className="min-w-0 gap-[clamp(14px,2.2svh,24px)] p-[clamp(18px,2.6svh,36px)] min-[1100px]:col-span-8">
          <div className="flex flex-col gap-1.5">
            <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[22px] min-[900px]:text-[clamp(22px,3.2svh,30px)] font-semibold leading-[1.1] tracking-[-0.03em]">
              <span>Item {item.code}</span>
              <span className="rounded-full bg-fill px-3 py-[3px] text-[13px] font-semibold tracking-normal text-muted">{KIND[obs.kind]}</span>
            </h1>
            <p className="text-[14px] text-muted">{dateLabel(audit.date)} · {quarterLabel(audit.quarter)} · Inspection {audit.inspectionNo}</p>
          </div>
          <p className="max-w-[60ch] text-[clamp(17px,2.2svh,20px)] font-semibold leading-[1.3] tracking-[-0.015em]">{item.question}</p>
          <p
            data-testid="observation-text"
            className="max-w-[72ch] whitespace-pre-line break-words text-[17px] leading-[1.6] [overflow-wrap:anywhere]"
          >
            {obs.text}
          </p>
          <Link
            href={href(`/audit/${audit.id}`, query)}
            className="mt-auto inline-flex h-10 w-fit items-center gap-1.5 rounded-full bg-ink px-5 text-[14px] font-semibold text-ground transition-transform active:scale-[0.97]"
          >
            Full report <ArrowRight size={15} strokeWidth={2.4} aria-hidden />
          </Link>
        </BentoCard>

        <div className="flex min-w-0 flex-col gap-[var(--gap-grid)] min-[1100px]:col-span-4">
          <BentoCard i={1} testid="photo" className="overflow-hidden">
            <div className="grid aspect-[4/3] place-items-center bg-surface-2 text-muted" role="img" aria-label={obs.hasPhoto ? 'Photo placeholder: a photo is attached in the audit report' : 'No photo for this observation'}>
              <div className="flex flex-col items-center gap-2 text-center">
                {obs.hasPhoto ? <Camera size={34} strokeWidth={1.8} aria-hidden /> : <ImageOff size={34} strokeWidth={1.8} aria-hidden />}
                <span className="text-[14px]">{obs.hasPhoto ? 'Photo in the audit report' : 'No photo'}</span>
              </div>
            </div>
          </BentoCard>
          <BentoCard i={2} testid="observation-meta" className="gap-4 p-[clamp(16px,2.2svh,26px)]">
            <TileLabel>Where it was seen</TileLabel>
            <CategoryChip id={cat} />
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[14px]">
              <dt className="text-muted">Contractor</dt>
              <dd className="font-semibold">{contractor.name}</dd>
              <dt className="text-muted">Region</dt>
              <dd>{contractor.subregion}</dd>
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
