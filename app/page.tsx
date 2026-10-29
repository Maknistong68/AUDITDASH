import { getRepo } from '@/lib/data/repo';
import { href, toSearchParams, type SP } from '@/lib/details';
import { filterToQuery, parseFilter } from '@/lib/filters';
import { contractorCards, coverage, filterAudits, mainProblem, movers, portfolioSummary, regionDuel, weakestSection } from '@/lib/analytics';
import { TopBar } from '@/components/shell/TopBar';
import { EmptyState } from '@/components/shell/EmptyState';
import { BentoGrid } from '@/components/bento/BentoGrid';
import { ContractorsCard } from '@/components/bento/ContractorsCard';
import { MainProblemCard } from '@/components/bento/MainProblemCard';
import { RegionDuelCard } from '@/components/bento/RegionDuelCard';
import { MoversCard } from '@/components/bento/MoversCard';
import { CoverageCard } from '@/components/bento/CoverageCard';
import { TypeDashboard } from '@/components/shell/TypeDashboard';

export default async function PortfolioPage({ searchParams }: { searchParams: Promise<SP> }) {
  const filter = parseFilter(toSearchParams(await searchParams));
  const repo = getRepo();
  const typed = filter.type !== undefined && filter.type !== 'hs' ? filter.type : null;
  const empty = portfolioSummary(repo, filter).audits === 0;
  const query = filterToQuery(filter);
  const cards = empty ? [] : contractorCards(repo, filter);
  const problem = empty || typed ? null : mainProblem(repo, filter);
  const duel = empty ? null : regionDuel(repo, filter);
  const moves = movers(repo, filter);
  const cover = coverage(repo, filter);
  // Carry an explicit filter into contractor pages (the default overview URL stays clean).
  const rowQuery = query ? `?${query}` : '';

  const tiles = (
    <>
      {duel && <RegionDuelCard {...duel} href={href('/audits', query)} />}
      {moves.quarter && <MoversCard quarter={moves.quarter} up={moves.up} down={moves.down} compared={moves.compared} query={rowQuery} />}
      {cover.quarter && <CoverageCard quarter={cover.quarter} regions={cover.regions} href={href('/audits', query)} />}
    </>
  );

  return (
    <>
      <TopBar filter={filter} />
      <main>
        {/* ≥1200px: one-viewport bento. Narrower: tiles stack and the page scrolls. */}
        <div
          data-testid="hero"
          className="flex flex-col px-[var(--gutter)] pb-[clamp(14px,2.4svh,32px)] pt-[clamp(6px,1.2svh,16px)] min-[1200px]:h-[calc(100svh-var(--topbar))]"
        >
          {typed ? (
            <TypeDashboard type={typed} cards={cards} contractors={repo.contractors().filter((c) => filter.regions.includes(c.subregion))} weakest={empty ? null : weakestSection(repo, filter)} tiles={empty ? null : tiles} />
          ) : empty ? (
            <EmptyState />
          ) : (
            <BentoGrid
              left={<ContractorsCard cards={cards} />}
              right={
                <>
                  {problem && (
                    <MainProblemCard
                      problem={problem}
                      audits={filterAudits(repo, { ...filter, quarter: problem.quarter }).length}
                      query={query}
                    />
                  )}
                  {tiles}
                </>
              }
            />
          )}
        </div>
      </main>
    </>
  );
}
