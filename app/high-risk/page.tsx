import type { Metadata } from 'next';
import { getRepo } from '@/lib/data/repo';
import { QUARTERS } from '@/lib/filters';
import { filterAudits, highRiskByContractor, highRiskByHazard, highRiskCount } from '@/lib/analytics';
import { isHazardId } from '@/lib/highRisk';
import { detailContext, href, toSearchParams, type SP } from '@/lib/details';
import { DetailFrame } from '@/components/details/DetailFrame';
import { HighRiskView } from '@/components/details/HighRiskView';

export const metadata: Metadata = { title: 'High-risk work' };

/**
 * High-risk work, one screen: a header strip (findings, Q4 → Q1 per audit, totals) over two panels: findings by hazard
 * type (a donut; a click filters the contractors to that hazard, `hz=` in the URL) and contractors ranked by findings
 * per audit (a click opens the contractor). No audits or no findings: a calm empty state under the same header.
 */
export default async function HighRiskPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const repo = getRepo();
  const { filter, query } = detailContext(sp);
  const overview = `/?${query}`;
  const hz = toSearchParams(sp).get('hz');
  const count = highRiskCount(repo, filter);
  const byQuarter = (filter.quarter === 'all' ? QUARTERS : [filter.quarter])
    .map((quarter) => ({
      quarter,
      count: highRiskCount(repo, { ...filter, quarter }),
      audits: filterAudits(repo, { ...filter, quarter }).length,
    }))
    .filter((q) => q.audits > 0);
  const contractors = highRiskByContractor(repo, filter).map((c) => ({ ...c, href: href(`/contractor/${c.id}`, query) }));
  const empty = !byQuarter.length ? 'No audits match this filter' : count === 0 ? 'No high-risk findings' : null;

  return (
    <DetailFrame filter={filter} crumbs={[{ label: 'Overview', href: overview }, { label: 'High-risk work' }]} parent={overview} fit>
      <HighRiskView
        count={count}
        byQuarter={byQuarter}
        hazards={highRiskByHazard(repo, filter)}
        contractors={contractors}
        latest={byQuarter.at(-1)?.quarter ?? null}
        initialHazard={isHazardId(hz) ? hz : null}
        empty={empty}
      />
    </DetailFrame>
  );
}
