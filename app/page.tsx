import { getRepo } from '@/lib/data/repo';
import { parseFilter, filterToQuery } from '@/lib/filters';
import { categoryGaps, league, portfolioSummary } from '@/lib/analytics';
import { TopBar } from '@/components/shell/TopBar';
import { Panel } from '@/components/shell/Panel';
import { ScorePanel } from '@/components/shell/ScorePanel';
import { EmptyState } from '@/components/shell/EmptyState';
import { GapRadar } from '@/components/charts/GapRadar';
import { LeagueBars } from '@/components/charts/LeagueBars';

type SP = Record<string, string | string[] | undefined>;

function toSearchParams(sp: SP): URLSearchParams {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') out.set(k, v);
    else if (Array.isArray(v) && v.length) out.set(k, v[0]);
  }
  return out;
}

export default async function PortfolioPage({ searchParams }: { searchParams: Promise<SP> }) {
  const filter = parseFilter(toSearchParams(await searchParams));
  const repo = getRepo();
  const summary = portfolioSummary(repo, filter);
  const empty = summary.audits === 0;
  const gaps = empty ? [] : categoryGaps(repo, filter);
  const rows = empty ? [] : league(repo, filter);
  const query = filterToQuery(filter);

  return (
    <>
      <TopBar filter={filter} />
      <main
        data-testid="hero"
        className="grid grid-cols-1 gap-[var(--gap)] px-4 pb-6 sm:px-6 min-[1200px]:h-[calc(100svh-var(--topbar))] min-[1200px]:min-h-[560px] min-[1200px]:grid-cols-[3fr_5fr_4fr]"
      >
        {/* ≥1200px: one-viewport hero, 3fr/5fr/4fr columns. Narrower: panels stack and the page scrolls. */}
        {empty ? (
          <EmptyState />
        ) : (
          <>
            <Panel title="Portfolio score">
              <ScorePanel {...summary} />
            </Panel>
            <Panel title="Gap by category" meta="worst first">
              <GapRadar gaps={gaps} query={query} />
            </Panel>
            <Panel title="Contractor league" meta={`${rows.length} contractors`}>
              <LeagueBars rows={rows} />
            </Panel>
          </>
        )}
      </main>
    </>
  );
}
