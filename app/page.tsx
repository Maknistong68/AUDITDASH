import { getRepo } from '@/lib/data/repo';
import { href, toSearchParams, type SP } from '@/lib/details';
import { QUARTERS, filterToQuery, parseFilter } from '@/lib/filters';
import {
  bandDistribution, compareContractors, contractorCards, filterAudits, followUps, mainProblem, portfolioSummary,
  positiveSummary, regionComparison, repeatFindings,
} from '@/lib/analytics';
import { MAX_COMPARE } from '@/lib/compare';
import { TopBar } from '@/components/shell/TopBar';
import { EmptyState } from '@/components/shell/EmptyState';
import type { CompareEntry } from '@/components/sections/CompareTray';
import { BentoGrid } from '@/components/bento/BentoGrid';
import { ContractorsCard } from '@/components/bento/ContractorsCard';
import { MainProblemCard } from '@/components/bento/MainProblemCard';
import { ScoreCard } from '@/components/bento/ScoreCard';
import { RepeatsCard } from '@/components/bento/RepeatsCard';
import { PositivesCard } from '@/components/bento/PositivesCard';
import { BandsCard } from '@/components/bento/BandsCard';
import { RegionCard } from '@/components/bento/RegionCard';
import { TypeEmpty } from '@/components/shell/TypeEmpty';

export default async function PortfolioPage({ searchParams }: { searchParams: Promise<SP> }) {
  const filter = parseFilter(toSearchParams(await searchParams));
  const repo = getRepo();
  const summary = portfolioSummary(repo, filter);
  const empty = summary.audits === 0;
  // A non-H&S tab has no imported audits; its dashboard fills from audits entered in the app (Task 14).
  const typeEmpty = empty && filter.type !== undefined && filter.type !== 'hs' ? filter.type : null;
  const cards = empty ? [] : contractorCards(repo, filter);

  // Compare data for every contractor, so selecting is instant (selection lives in ?c= on the client).
  const compare: Record<string, CompareEntry> = {};
  const ids = cards.map((c) => c.contractor.id);
  for (let i = 0; i < ids.length; i += MAX_COMPARE) {
    for (const x of compareContractors(repo, filter, ids.slice(i, i + MAX_COMPARE))) {
      compare[x.card.contractor.id] = {
        card: x.card,
        gaps: x.gaps.map((g) => ({ category: g.category, gapRate: g.gapRate })),
        repeatCount: x.repeats.length,
        topRepeats: x.repeats.slice(0, 3).map((r) => ({ itemCode: r.itemCode, question: r.question })),
      };
    }
  }

  const problem = empty ? null : mainProblem(repo, filter);
  // Repeat findings: the same question noted again at the contractor's next audit; null without a follow-up audit ("—").
  const pairs = empty ? [] : followUps(repo, filter);
  const repeats = pairs.length ? repeatFindings(repo, filter) : null;
  const query = filterToQuery(filter);
  const byQuarter = QUARTERS.map((q) => ({ label: q.replace('-', ' '), value: portfolioSummary(repo, { ...filter, quarter: q }).avgScore }));

  return (
    <>
      <TopBar filter={filter} />
      <main>
        {/* ≥1200px: one-viewport bento. Narrower: tiles stack and the page scrolls. */}
        <div
          data-testid="hero"
          className="flex flex-col px-[var(--gutter)] pb-[clamp(14px,2.4svh,32px)] pt-[clamp(6px,1.2svh,16px)] min-[1200px]:h-[calc(100svh-var(--topbar))]"
        >
          {typeEmpty ? (
            <TypeEmpty type={typeEmpty} />
          ) : empty ? (
            <EmptyState />
          ) : (
            <BentoGrid
              left={<ContractorsCard cards={cards} compare={compare} />}
              right={
                <>
                  {problem && (
                    <MainProblemCard
                      problem={problem}
                      audits={filterAudits(repo, { ...filter, quarter: problem.quarter }).length}
                      query={query}
                    />
                  )}
                  <ScoreCard avgScore={summary.avgScore} band={summary.band} delta={summary.delta} audits={summary.audits} quarter={filter.quarter} byQuarter={byQuarter} href={href('/audits', query)} />
                  <RepeatsCard
                    repeats={repeats ? repeats.length : null}
                    questions={new Set(repeats?.map((r) => r.itemCode)).size}
                    contractors={new Set(repeats?.map((r) => r.contractor.id)).size}
                    followUps={pairs.length}
                    href={href('/repeats', query)}
                  />
                  <PositivesCard summary={positiveSummary(repo, filter)} href={href('/positives', query)} />
                  <BandsCard bands={bandDistribution(repo, filter)} href={`${href('/audits', query)}&focus=bands`} />
                  <RegionCard rows={regionComparison(repo, filter)} quarter={filter.quarter} href={`${href('/audits', query)}&focus=regions`} />
                </>
              }
            />
          )}
        </div>
      </main>
    </>
  );
}
