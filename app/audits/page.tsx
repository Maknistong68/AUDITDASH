import type { Metadata } from 'next';
import { getRepo } from '@/lib/data/repo';
import { QUARTERS, REGIONS } from '@/lib/filters';
import { bandDistribution, filterAudits, portfolioSummary, regionComparison } from '@/lib/analytics';
import { detailContext, href, toSearchParams, type SP } from '@/lib/details';
import { monthTicks, parseBand, splitName, timeDomain, timelineRows, xOf } from '@/lib/timeline';
import { DetailFrame } from '@/components/details/DetailFrame';
import { AuditsView, type AuditsRow, type Focus } from '@/components/details/AuditsView';

export const metadata: Metadata = { title: 'Portfolio' };

/**
 * Portfolio, one screen (the Portfolio score, Contractors by band and Region cards open it): a header strip (score, Q4 → Q1,
 * audits) over the past-audits timeline (one row per contractor, a dot per audit on a time axis; a dot opens the report)
 * and a side column with the band distribution (filters the rows, `band=`) and SR1 vs SR2 per quarter (sets `r=`).
 * `focus=bands|regions` rings the panel of the card that opened it. No audits: a calm empty state under the same header.
 */
export default async function AuditsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const params = toSearchParams(sp);
  const repo = getRepo();
  const { filter, query } = detailContext(sp);
  const overview = `/?${query}`;
  const quarters = filter.quarter === 'all' ? QUARTERS : [filter.quarter];
  const audits = filterAudits(repo, filter);
  const summary = portfolioSummary(repo, filter);
  const byQuarter = quarters
    .map((quarter) => ({ quarter, value: portfolioSummary(repo, { ...filter, quarter }).avgScore }))
    .filter((q) => q.value !== null);
  const domain = timeDomain(quarters);
  const rows: AuditsRow[] = timelineRows(audits, repo.contractors()).map((r) => ({
    id: r.id,
    name: r.name,
    ...splitName(r.name),
    href: href(`/contractor/${r.id}`, query),
    latestBand: r.latestBand,
    trends: r.trends,
    audits: r.audits.map((a) => ({ ...a, x: xOf(a.date, domain), href: href(`/audit/${a.id}`, query) })),
  }));
  // Both regions always listed (the unselected one dimmed, a click selects it); the quarters shown follow the filter.
  const regions = regionComparison(repo, { ...filter, regions: [...REGIONS] }).map((r) => ({
    region: r.region,
    selected: filter.regions.includes(r.region),
    byQuarter: quarters.map((quarter) => ({ quarter, value: r.byQuarter[quarter] })),
  }));
  const focus = params.get('focus');

  return (
    <DetailFrame filter={filter} crumbs={[{ label: 'Overview', href: overview }, { label: 'Portfolio' }]} parent={overview} fit>
      <AuditsView
        avg={summary.avgScore}
        band={summary.band}
        auditCount={audits.length}
        byQuarter={byQuarter}
        rows={rows}
        axis={{ quarters: domain.quarters, months: monthTicks(domain) }}
        bands={bandDistribution(repo, filter)}
        regions={regions}
        initialBand={parseBand(params.get('band'))}
        focus={focus === 'bands' || focus === 'regions' ? (focus as Focus) : null}
        empty={audits.length === 0 ? 'No audits match this filter' : null}
      />
    </DetailFrame>
  );
}
