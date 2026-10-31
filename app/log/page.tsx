import type { Metadata } from 'next';
import { getRepo } from '@/lib/data/repo';
import { toSearchParams, type SP } from '@/lib/details';
import { filterToQuery } from '@/lib/filters';
import { buildLog, parseLogState } from '@/lib/log';
import { DetailFrame } from '@/components/details/DetailFrame';
import { LogView } from '@/components/log/LogView';

export const metadata: Metadata = { title: 'Log' };

/**
 * The Log: every previous observation and every audit, searchable and filterable, from the auditor's point of view.
 * The server reads the repo once and hands compact rows to the client, which filters them live; the whole search
 * (view, text, filters, sort) lives in the URL so it can be shared. Quarter and regions are the app-wide `q` / `r`.
 */
export default async function LogPage({ searchParams }: { searchParams: Promise<SP> }) {
  const repo = await getRepo();
  const state = parseLogState(toSearchParams(await searchParams));
  const filter = { quarter: state.quarter, regions: state.regions };
  const overview = `/?${filterToQuery(filter)}`;
  const data = buildLog(repo);
  // Contractors that have audits, by name.
  const seen = new Map(data.audits.map((a) => [a.contractorId, a.contractor]));
  const contractors = [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <DetailFrame filter={filter} crumbs={[{ label: 'Overview', href: overview }, { label: 'Log' }]} parent={overview}>
      <LogView data={data} contractors={contractors} initial={state} />
    </DetailFrame>
  );
}
