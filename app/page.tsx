import { getRepo } from '@/lib/data/repo';
import { href, toSearchParams, type SP } from '@/lib/details';
import { filterToQuery, parseFilter } from '@/lib/filters';
import {
  bandDistribution, categoryCards, compareContractors, contractorCards, excelCheck, filterAudits, followUps, monthlyScores,
  portfolioSummary, positiveSummary, positivesByContractor, repeatMatrix,
} from '@/lib/analytics';
import { REGIONS } from '@/lib/filters';
import { TrendCard } from '@/components/bento/TrendCard';
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

  const ranked = empty ? [] : categoryCards(repo, filter);
  const problem = ranked[0] ?? null;
  // Repeat findings: a question that is a finding again at the contractor's next audit; null without a follow-up audit ("—").
  const pairs = empty ? [] : followUps(repo, filter);
  const matrix = pairs.length ? repeatMatrix(repo, filter) : null;
  const query = filterToQuery(filter);
  const insight = {
    best: cards.length ? { name: cards[0].contractor.name, score: cards[0].total } : null,
    worst: cards.length > 1 ? { name: cards.at(-1)!.contractor.name, score: cards.at(-1)!.total } : null,
    regions: REGIONS.filter((r) => filter.regions.includes(r)).map((r) => ({ region: r, score: portfolioSummary(repo, { ...filter, regions: [r] }).avgScore })),
    excel: excelCheck(repo, filter),
  };

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
              left={
                <>
                  <ContractorsCard cards={cards} compare={compare} />
                  <TrendCard points={monthlyScores(repo, filter)} />
                </>
              }
              right={
                <>
                  {problem && (
                    <MainProblemCard
                      problem={problem}
                      audits={filterAudits(repo, { ...filter, quarter: problem.quarter }).length}
                      query={query}
                      ranking={ranked.map((r) => ({ category: r.category, gapRate: r.gapRate }))}
                    />
                  )}
                  <ScoreCard
                    avgScore={summary.avgScore}
                    band={summary.band}
                    audits={summary.audits}
                    delta={summary.delta}
                    bands={bandDistribution(repo, filter)}
                    insight={insight}
                    href={href('/log', `${query}&view=audits`)}
                  />
                  <RepeatsCard
                    repeats={matrix ? matrix.questions.reduce((s, q) => s + q.total, 0) : null}
                    top={(matrix?.questions ?? []).slice(0, 3).map((q) => ({ key: q.itemCode, label: q.label, times: q.total }))}
                    byContractor={(matrix?.contractors ?? []).map((c) => ({ name: c.name, total: c.total }))}
                    href={href('/repeats', query)}
                  />
                  <PositivesCard
                    summary={positiveSummary(repo, filter)}
                    leaders={positivesByContractor(repo, filter)
                      .filter((p) => p.count > 0)
                      .sort((a, b) => b.perAudit - a.perAudit)
                      .map((p) => ({ name: p.contractor.name, count: p.count, perAudit: p.perAudit }))}
                    href={href('/positives', query)}
                  />
                </>
              }
            />
          )}
        </div>
      </main>
    </>
  );
}
