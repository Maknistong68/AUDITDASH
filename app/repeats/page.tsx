import type { Metadata } from 'next';
import { getRepo } from '@/lib/data/repo';
import { followUps, repeatContractors, repeatFindings, repeatQuestions, repeatSpread } from '@/lib/analytics';
import { detailContext, href, type SP } from '@/lib/details';
import { splitName } from '@/lib/timeline';
import { DetailFrame } from '@/components/details/DetailFrame';
import { RepeatsView, type RepeatCol, type RepeatRow } from '@/components/details/RepeatsView';

export const metadata: Metadata = { title: 'Repeat findings' };

/** Latest repeating audit's section score → score lost, in four steps (0 = little lost … 3 = most); null when the section was not scored. */
const step = (ratio: number | null) => {
  if (ratio === null) return null;
  const lost = 1 - Math.min(1, Math.max(0, ratio));
  return lost < 0.2 ? 0 : lost < 0.4 ? 1 : lost < 0.6 ? 2 : 3;
};

/**
 * Repeat findings, one screen: a header strip (repeat findings, how widespread, what they are made of) over a
 * questions × contractors dot matrix. A repeat is the same question noted again at the contractor's next audit of the
 * same type; without a follow-up audit in the filter, a calm empty state under the same header.
 */
export default async function RepeatsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const repo = getRepo();
  const { filter, query } = detailContext(await searchParams);
  const overview = `/?${query}`;
  const pairs = followUps(repo, filter);
  const findings = pairs.length ? repeatFindings(repo, filter) : [];
  const repeats = pairs.length ? repeatQuestions(repo, filter) : [];
  const contractors = repeatContractors(repo, filter);
  const hits = (id: string) => repeats.filter((r) => r.contractors.some((c) => c.id === id)).length;
  const cols: RepeatCol[] = contractors
    .map((c) => ({ id: c.id, name: c.name, ...splitName(c.name), hits: hits(c.id), href: href(`/contractor/${c.id}`, query) }))
    .sort((a, b) => b.hits - a.hits || a.name.localeCompare(b.name));
  const rows: RepeatRow[] = repeats.map((r) => ({
    key: r.itemCode,
    label: r.label,
    reach: r.contractorCount,
    times: r.times,
    href: href(`/category/${r.category}`, query, { hash: `item-${r.itemCode}` }),
    cells: cols.map((c) => {
      const sc = r.sectionScores.find((x) => x.contractorId === c.id);
      if (!sc) return null;
      return {
        step: step(sc.ratio),
        lost: sc.ratio === null ? null : Math.round((1 - Math.min(1, Math.max(0, sc.ratio))) * 100),
        href: href(`/category/${r.category}/${c.id}/${encodeURIComponent(r.itemCode)}`, query),
      };
    }),
  }));
  const empty = pairs.length ? (repeats.length ? null : 'No questions repeated') : 'Needs a follow-up audit';

  return (
    <DetailFrame filter={filter} crumbs={[{ label: 'Overview', href: overview }, { label: 'Repeat findings' }]} parent={overview} fit>
      <RepeatsView
        count={pairs.length ? findings.length : null}
        stats={{ questions: repeats.length, contractors: new Set(findings.map((f) => f.contractor.id)).size, followUps: pairs.length }}
        spread={repeatSpread(repeats, contractors.length)}
        rows={rows}
        cols={cols}
        empty={empty}
      />
    </DetailFrame>
  );
}
