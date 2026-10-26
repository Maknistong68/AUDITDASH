import { notFound } from 'next/navigation';
import { getRepo } from '@/lib/data/repo';
import { auditCompliance, auditItemStates, contractorAudits } from '@/lib/analytics';
import { categoryById } from '@/lib/categories';
import { parseSlide } from '@/lib/carousel';
import { detailContext, href, type SP } from '@/lib/details';
import { dateLabel, quarterLabel } from '@/lib/format';
import { findCategory, findContractor } from '@/lib/routeParams';
import { DetailEmpty, DetailFrame, PageTitle } from '@/components/details/DetailFrame';
import { ItemsSlide } from '@/components/details/ItemsSlide';
import { CategoryChip } from '@/components/details/parts';
import { AuditCarousel } from '@/components/motion/AuditCarousel';

type Params = { cat: string; contractor: string };

/** A contractor within one category: carousel of its audits, each item noted / no note / N/A, with its section gap. */
export default async function ContractorInCategoryPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<SP> }) {
  const p = await params;
  const repo = getRepo();
  const cat = findCategory(p.cat);
  const contractor = findContractor(repo, p.contractor);
  if (!cat || !contractor) notFound();
  const { filter, query, s } = detailContext(await searchParams);
  const c = categoryById(cat);
  const rows = contractorAudits(repo, filter, contractor.id);
  const parent = href(`/category/${cat}`, query);
  const crumbs = [
    { label: 'Overview', href: `/?${query}` },
    { label: c.name, href: parent },
    { label: contractor.name },
  ];
  const items = repo.checklist().filter((i) => i.category === cat);
  const history = rows.map(({ audit }) => {
    const comp = auditCompliance(audit, items);
    return { id: audit.id, date: audit.date, gap: comp === null ? null : 1 - comp };
  });
  const title = (
    <PageTitle meta={<span className="inline-flex flex-wrap items-center gap-2"><CategoryChip id={cat} /> <span>{contractor.subregion} · {rows.length} {rows.length === 1 ? 'audit' : 'audits'}</span></span>}>
      {contractor.name}
    </PageTitle>
  );

  return (
    <DetailFrame filter={filter} crumbs={crumbs} parent={parent}>
      {rows.length === 0 ? (
        <>
          <div className="px-[var(--gutter)] pb-4">{title}</div>
          <DetailEmpty title="No audits match this filter" />
        </>
      ) : (
        <AuditCarousel
          unit="audit"
          initial={parseSlide(s, rows.length)}
          labels={rows.map((r) => `${dateLabel(r.audit.date)} · ${quarterLabel(r.audit.quarter)}`)}
          title={title}
          slides={rows.map(({ audit, previous }) => (
            <ItemsSlide
              key={audit.id}
              d={{
                audit, previous, categoryName: c.name, history,
                rows: auditItemStates(repo, audit, cat),
                itemHref: (code) => href(`/category/${cat}/${contractor.id}/${encodeURIComponent(code)}`, query),
              }}
            />
          ))}
        />
      )}
    </DetailFrame>
  );
}
