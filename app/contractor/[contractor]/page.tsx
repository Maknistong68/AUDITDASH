import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getRepo } from '@/lib/data/repo';
import { auditFindings, auditGaps, contractorAudits, contractorRepeats, sectionRatios, regionPath } from '@/lib/analytics';
import { initialSlide } from '@/lib/carousel';
import { detailContext, href, type SP } from '@/lib/details';
import { dateLabel } from '@/lib/format';
import { DetailEmpty, DetailFrame, PageTitle } from '@/components/details/DetailFrame';
import { ContractorSlide } from '@/components/details/ContractorSlide';
import { AuditCarousel } from '@/components/motion/AuditCarousel';
import { HandoffLanding } from '@/components/motion/HandoffLink';
import { CONTRACTOR_NAME } from '@/lib/handoff';

type Params = { contractor: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { contractor: id } = await params;
  const c = getRepo().contractors().find((x) => x.id === id);
  return { title: c ? c.name : 'Not found' };
}

/**
 * Contractor details, one screen: a score chart across its audits (date order) beside the title, over a swipeable
 * history of its audits (latest first) within the filter's regions; the quarter filter only picks the opening slide. The
 * landing of a dashboard Contractors row hand-off: its name → the title, its score → the opened audit's score.
 */
export default async function ContractorPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<SP> }) {
  const { contractor: id } = await params;
  const repo = getRepo();
  const contractor = repo.contractors().find((c) => c.id === id);
  if (!contractor) notFound();
  const { filter, query, s } = detailContext(await searchParams);
  const rows = contractorAudits(repo, filter, id);
  const overview = `/?${query}`;
  const crumbs = [{ label: 'Overview', href: overview }, { label: contractor.name }];

  const initial = initialSlide(s, rows.map((r) => r.audit.quarter), filter.quarter);
  const repeats = contractorRepeats(repo, filter, id).slice(0, 3);
  const slides = rows.map(({ audit, previous }, index) => {
    const { positives } = auditFindings(repo, audit);
    return (
      <ContractorSlide
        key={audit.id}
        d={{
          audit, previous, index, contractorId: id, query, positives,
          landing: index === initial,
          sections: sectionRatios(audit),
          gaps: auditGaps(repo, audit),
          repeats,
        }}
      />
    );
  });
  const name = <span style={{ viewTransitionName: CONTRACTOR_NAME }}>{contractor.name}</span>;

  return (
    <DetailFrame filter={filter} crumbs={crumbs} parent={overview} fit>
      <HandoffLanding />
      {rows.length === 0 ? (
        <>
          <div className="px-[var(--gutter)] pb-4"><PageTitle meta={`${regionPath(repo, contractor.id) || '—'}${contractor.active ? '' : ' · Inactive'}`}>{name}</PageTitle></div>
          <DetailEmpty
            title={`No audits in ${filter.regions.join(' + ') || 'the selected regions'}`}
            action={<Link href={href(`/contractor/${id}`, 'q=all&r=SR1%2CSR2')} className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-[14px] font-semibold text-ground">Show all regions</Link>}
          />
        </>
      ) : (
        <AuditCarousel
          unit="audit"
          fit
          initial={initial}
          labels={rows.map((r) => dateLabel(r.audit.date))}
          slides={slides}
          trend={[...rows].reverse().map(({ audit }) => ({ auditId: audit.id, date: audit.date, label: dateLabel(audit.date), score: audit.totalScore }))}
          title={
            <PageTitle meta={`${regionPath(repo, contractor.id)}${contractor.active ? '' : ' · Inactive'} · ${rows.length} ${rows.length === 1 ? 'audit' : 'audits'}`}>
              {name}
            </PageTitle>
          }
        />
      )}
    </DetailFrame>
  );
}
