import type { Metadata } from 'next';
import { getRepo } from '@/lib/data/repo';
import { repeatAudits, repeatContractors, repeatNotesPerAudit, repeatSpread, repeatThreshold, systemicRepeats } from '@/lib/analytics';
import { detailContext, href, type SP } from '@/lib/details';
import { splitName } from '@/lib/timeline';
import { DetailFrame } from '@/components/details/DetailFrame';
import { RepeatsView, type RepeatCol, type RepeatRow } from '@/components/details/RepeatsView';

export const metadata: Metadata = { title: 'Repeat findings' };

/** Latest section score → score lost, in four steps (0 = little lost … 3 = most); null when the section was not scored. */
const step = (ratio: number | null) => {
  if (ratio === null) return null;
  const lost = 1 - Math.min(1, Math.max(0, ratio));
  return lost < 0.2 ? 0 : lost < 0.4 ? 1 : lost < 0.6 ? 2 : 3;
};

/**
 * Repeat findings, one screen: a header strip (questions repeating, how widespread, Q4 → Q1 notes) over an
 * issues × contractors dot matrix. Needs both quarters; otherwise a calm empty state under the same header.
 */
export default async function RepeatsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const repo = getRepo();
  const { filter, query } = detailContext(await searchParams);
  const overview = `/?${query}`;
  const twoQuarters = filter.quarter !== 'Q4-2025';
  const repeats = twoQuarters ? systemicRepeats(repo, filter) : [];
  const contractors = twoQuarters ? repeatContractors(repo, filter) : [];
  const hits = (id: string) => repeats.filter((r) => r.contractors.some((c) => c.id === id)).length;
  const cols: RepeatCol[] = contractors
    .map((c) => ({ id: c.id, name: c.name, ...splitName(c.name), hits: hits(c.id), href: href(`/contractor/${c.id}`, query) }))
    .sort((a, b) => b.hits - a.hits || a.name.localeCompare(b.name));
  const rows: RepeatRow[] = repeats.map((r) => ({
    key: r.itemCode,
    label: r.label,
    reach: r.contractorCount,
    q4: r.q4Audits,
    q1: r.q1Audits,
    href: href(`/category/${r.category}`, query, { hash: `item-${r.itemCode}` }),
    cells: cols.map((c) => {
      if (!r.contractors.some((x) => x.id === c.id)) return null;
      const sc = r.sectionScores.find((x) => x.contractorId === c.id);
      const ratio = sc ? (sc.q1 ?? sc.q4) : null;
      return {
        step: step(ratio),
        lost: ratio === null ? null : Math.round((1 - Math.min(1, Math.max(0, ratio))) * 100),
        href: href(`/category/${r.category}/${c.id}/${encodeURIComponent(r.itemCode)}`, query),
      };
    }),
  }));
  // Audits per quarter of the eligible contractors (audited in both quarters): the denominators, over the same audits as
  // the notes, so neither a quarter with more audits nor a contractor audited once reads as a rise.
  const audits = repeatAudits(repo, filter);
  const eligible = contractors.length;
  const empty = twoQuarters ? (repeats.length ? null : 'No questions repeating') : 'Needs an earlier quarter';

  return (
    <DetailFrame filter={filter} crumbs={[{ label: 'Overview', href: overview }, { label: 'Repeat findings' }]} parent={overview} fit>
      <RepeatsView
        count={twoQuarters ? repeats.length : null}
        spread={repeatSpread(repeats)}
        rates={repeatNotesPerAudit(repeats, audits)}
        threshold={{ min: repeatThreshold(eligible), of: eligible }}
        audits={audits}
        rows={rows}
        cols={cols}
        empty={empty}
      />
    </DetailFrame>
  );
}
