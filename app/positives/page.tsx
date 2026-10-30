import type { Metadata } from 'next';
import { getRepo } from '@/lib/data/repo';
import { positiveNotes, positiveSummary, positivesByContractor } from '@/lib/analytics';
import { detailContext, href, type SP } from '@/lib/details';
import { dateLabel } from '@/lib/format';
import { DetailFrame } from '@/components/details/DetailFrame';
import { PositivesView } from '@/components/details/PositivesView';

export const metadata: Metadata = { title: 'Positive observations' };

/**
 * Positive observations, one screen: a header strip (the count and how widely it was recorded) over two panels:
 * contractors ranked by positives per audit (a row opens the contractor) and the good practice itself, newest first
 * (a note opens its audit report on the Positive observations tab). No audits or no positives: a calm empty state.
 */
export default async function PositivesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const repo = getRepo();
  const { filter, query } = detailContext(await searchParams);
  const overview = `/?${query}`;
  const summary = positiveSummary(repo, filter);
  const contractors = positivesByContractor(repo, filter).map((r) => ({
    id: r.contractor.id, name: r.contractor.name, count: r.count, audits: r.audits, perAudit: r.perAudit,
    href: href(`/contractor/${r.contractor.id}`, query),
  }));
  const notes = positiveNotes(repo, filter).map((n) => ({
    id: n.id, text: n.text, contractor: n.contractor.name, date: dateLabel(n.date),
    href: `${href(`/audit/${encodeURIComponent(n.auditId)}`, query)}&tab=positive`,
  }));
  const empty = summary.audits === 0 ? 'No audits match this filter' : summary.total === 0 ? 'No positive observations' : null;

  return (
    <DetailFrame filter={filter} crumbs={[{ label: 'Overview', href: overview }, { label: 'Positive observations' }]} parent={overview} fit>
      <PositivesView summary={summary} contractors={contractors} notes={notes} empty={empty} />
    </DetailFrame>
  );
}
