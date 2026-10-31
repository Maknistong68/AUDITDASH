import type { Metadata } from 'next';
import { getRepo } from '@/lib/data/repo';
import { followUps, repeatMatrix } from '@/lib/analytics';
import { CATEGORIES } from '@/lib/categories';
import { detailContext, href, type SP } from '@/lib/details';
import { splitName } from '@/lib/timeline';
import { DetailFrame } from '@/components/details/DetailFrame';
import { RepeatsView, type HeatCol, type HeatGroup } from '@/components/details/RepeatsView';

export const metadata: Metadata = { title: 'Repeat findings' };

/**
 * Repeat findings, one screen: a header strip (the repeat count, questions and contractors behind it) over an
 * Excel-style heat map of times repeated, questions × contractors (lib/analytics repeatMatrix). A repeat is a question
 * that is a finding in a contractor's audit and again in its next audit of the same type; without a follow-up audit in
 * the filter, a calm empty state under the same header.
 */
export default async function RepeatsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const repo = await getRepo();
  const { filter, query } = detailContext(await searchParams);
  const overview = `/?${query}`;
  const pairs = followUps(repo, filter);
  const m = repeatMatrix(repo, filter);
  const total = m.questions.reduce((s, q) => s + q.total, 0);

  const cols: HeatCol[] = m.contractors.map((c) => ({ ...c, ...splitName(c.name), href: href(`/contractor/${c.id}`, query) }));
  // Rows grouped by category: groups in the order their first (most repeated) question appears, rows keep their order.
  const groups: HeatGroup[] = [];
  for (const q of m.questions) {
    let g = groups.find((x) => x.id === q.category);
    if (!g) groups.push((g = { id: q.category, name: CATEGORIES.find((c) => c.id === q.category)!.name, rows: [] }));
    g.rows.push({
      key: q.itemCode,
      label: q.label,
      total: q.total,
      href: href(`/category/${q.category}`, query, { hash: `item-${q.itemCode}` }),
      cells: cols.map((c) => ({
        n: m.cells[c.id]?.[q.itemCode] ?? 0,
        href: href(`/category/${q.category}/${c.id}/${encodeURIComponent(q.itemCode)}`, query),
      })),
    });
  }
  const empty = pairs.length ? (m.questions.length ? null : 'No questions repeated') : 'Needs a follow-up audit';

  return (
    <DetailFrame filter={filter} crumbs={[{ label: 'Overview', href: overview }, { label: 'Repeat findings' }]} parent={overview} fit>
      <RepeatsView
        count={pairs.length ? total : null}
        stats={{ questions: m.questions.length, contractors: m.contractors.length }}
        groups={groups}
        cols={cols}
        empty={empty}
      />
    </DetailFrame>
  );
}
