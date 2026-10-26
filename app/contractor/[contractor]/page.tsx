import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getRepo } from '@/lib/data/repo';
import { auditFindings, auditGaps, contractorAudits, sectionRatios } from '@/lib/analytics';
import { categoryById } from '@/lib/categories';
import { parseSlide } from '@/lib/carousel';
import { detailContext, href, type SP } from '@/lib/details';
import { dateLabel, quarterLabel } from '@/lib/format';
import { DetailEmpty, DetailFrame, PageTitle } from '@/components/details/DetailFrame';
import { ContractorSlide } from '@/components/details/ContractorSlide';
import { AuditCarousel } from '@/components/motion/AuditCarousel';

type Params = { contractor: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { contractor: id } = await params;
  const c = getRepo().contractors().find((x) => x.id === id);
  return { title: c ? `${c.name} · HSE Audits` : 'Not found · HSE Audits' };
}

/** Contractor details: a swipeable history of its audits (latest first) within the filter's regions. */
export default async function ContractorPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<SP> }) {
  const { contractor: id } = await params;
  const repo = getRepo();
  const contractor = repo.contractors().find((c) => c.id === id);
  if (!contractor) notFound();
  const { filter, query, s } = detailContext(await searchParams);
  const rows = contractorAudits(repo, filter, id);
  const overview = `/?${query}`;
  const crumbs = [{ label: 'Overview', href: overview }, { label: contractor.name }];

  const items = new Map(repo.checklist().map((i) => [i.code, i]));
  const slides = rows.map(({ audit, previous }, index) => {
    const { groups, positives } = auditFindings(repo, audit);
    return (
      <ContractorSlide
        key={audit.id}
        d={{
          audit, previous, index, contractorId: id, query, positives,
          sections: sectionRatios(audit),
          gaps: auditGaps(repo, audit),
          findings: groups.reduce((n, g) => n + g.observations.length, 0),
          groups: groups.map((g) => {
            const c = categoryById(g.category);
            return {
              category: c.id, name: c.name, icon: c.icon, color: c.color,
              findings: g.observations.map((o) => {
                const item = o.itemCode ? items.get(o.itemCode) : undefined;
                return {
                  id: o.id, code: o.itemCode, text: o.text,
                  href: item ? href(`/category/${item.category}/${id}/${item.code}/${o.id}`, query) : null,
                };
              }),
            };
          }),
        }}
      />
    );
  });

  return (
    <DetailFrame filter={filter} crumbs={crumbs} parent={overview}>
      {rows.length === 0 ? (
        <>
          <div className="px-[var(--gutter)] pb-4"><PageTitle meta={`${contractor.subregion} · Contract ${contractor.contractNo}`}>{contractor.name}</PageTitle></div>
          <DetailEmpty
            title={`No audits in ${filter.regions.join(' + ') || 'the selected regions'}`}
            action={<Link href={href(`/contractor/${id}`, 'q=all&r=SR1%2CSR2')} className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-[14px] font-semibold text-ground">Show all regions</Link>}
          />
        </>
      ) : (
        <AuditCarousel
          unit="audit"
          initial={parseSlide(s, rows.length)}
          labels={rows.map((r) => `${dateLabel(r.audit.date)} · ${quarterLabel(r.audit.quarter)}`)}
          slides={slides}
          title={
            <PageTitle meta={`${contractor.subregion} · Contract ${contractor.contractNo} · ${rows.length} ${rows.length === 1 ? 'audit' : 'audits'}`}>
              {contractor.name}
            </PageTitle>
          }
        />
      )}
    </DetailFrame>
  );
}
