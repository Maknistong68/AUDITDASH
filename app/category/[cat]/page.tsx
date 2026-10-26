import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getRepo } from '@/lib/data/repo';
import { categoryQuarters, contractorAudits } from '@/lib/analytics';
import { categoryById } from '@/lib/categories';
import { initialSlide } from '@/lib/carousel';
import { detailContext, href, type SP } from '@/lib/details';
import { quarterLabel } from '@/lib/format';
import { findCategory } from '@/lib/routeParams';
import { DetailEmpty, DetailFrame } from '@/components/details/DetailFrame';
import { CategorySlide } from '@/components/details/CategorySlide';
import { CategoryTitle } from '@/components/details/CategoryTitle';
import { AuditCarousel } from '@/components/motion/AuditCarousel';

type Params = { cat: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const id = findCategory((await params).cat);
  return { title: id ? categoryById(id).name : 'Not found' };
}

/** Category details: a carousel by quarter (latest first) within the filter's regions. */
export default async function CategoryPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<SP> }) {
  const id = findCategory((await params).cat);
  if (!id) notFound();
  const repo = getRepo();
  const { filter, query, s } = detailContext(await searchParams);
  const quarters = categoryQuarters(repo, filter, id);
  const overview = `/?${query}`;
  const cat = categoryById(id);
  const initial = initialSlide(s, quarters.map((q) => q.quarter), filter.quarter);
  const items = repo.checklist().filter((i) => i.category === id).length;
  const title = <CategoryTitle id={id} meta={`${items} checklist items · gap by quarter`} />;

  return (
    <DetailFrame filter={filter} crumbs={[{ label: 'Overview', href: overview }, { label: cat.name }]} parent={overview}>
      {quarters.length === 0 ? (
        <>
          <div className="px-[var(--gutter)] pb-4">{title}</div>
          <DetailEmpty title="No audits match this filter" />
        </>
      ) : (
        <AuditCarousel
          unit="quarter"
          initial={initial}
          labels={quarters.map((q) => quarterLabel(q.quarter))}
          title={title}
          slides={quarters.map((q, i) => (
            <CategorySlide
              key={q.quarter}
              d={{
                q,
                anchors: i === initial,
                prevQuarter: quarters[i + 1] ? quarterLabel(quarters[i + 1].quarter) : null,
                contractorHref: (cid) => {
                  // open the contractor-in-category carousel on this quarter's latest audit
                  const s = contractorAudits(repo, filter, cid).findIndex((r) => r.audit.quarter === q.quarter);
                  return href(`/category/${id}/${cid}`, query, { s: Math.max(0, s) });
                },
              }}
            />
          ))}
        />
      )}
    </DetailFrame>
  );
}
