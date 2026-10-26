import { getRepo } from '@/lib/data/repo';
import { QUARTERS, filterToQuery, parseFilter } from '@/lib/filters';
import {
  bandDistribution, compareContractors, contractorCards, filterAudits, highRiskCount, mainProblem, portfolioSummary,
  regionComparison, repeatFindings,
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
import { HighRiskCard } from '@/components/bento/HighRiskCard';
import { BandsCard } from '@/components/bento/BandsCard';
import { RegionCard } from '@/components/bento/RegionCard';

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
  const repeats = filter.quarter === 'Q4-2025' || empty ? null : repeatFindings(repo, filter);
  // Items repeated by the most contractors (ties: lower item code first).
  const by = new Map<string, { question: string; n: number }>();
  for (const r of repeats ?? []) by.set(r.itemCode, { question: r.question, n: (by.get(r.itemCode)?.n ?? 0) + 1 });
  const topRepeats = [...by]
    .sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0], undefined, { numeric: true }))
    .slice(0, 3)
    .map(([itemCode, v]) => ({ itemCode, question: v.question, contractors: v.n }));
  const byQuarter = QUARTERS.map((q) => ({ label: q.replace('-', ' '), value: portfolioSummary(repo, { ...filter, quarter: q }).avgScore }));

  return (
    <>
      <TopBar filter={filter} />
      {/* ≥1200px: one-viewport bento. Narrower: tiles stack and the page scrolls. */}
      <main
        data-testid="hero"
        className="flex flex-col px-[var(--gutter)] pb-[clamp(14px,2.4svh,32px)] pt-[clamp(6px,1.2svh,16px)] min-[1200px]:h-[calc(100svh-var(--topbar))]"
      >
        {empty ? (
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
                    query={filterToQuery(filter)}
                  />
                )}
                <ScoreCard avgScore={summary.avgScore} band={summary.band} delta={summary.delta} audits={summary.audits} quarter={filter.quarter} byQuarter={byQuarter} />
                <RepeatsCard repeats={repeats ? repeats.length : null} top={topRepeats} />
                <HighRiskCard count={highRiskCount(repo, filter)} />
                <BandsCard bands={bandDistribution(repo, filter)} />
                <RegionCard rows={regionComparison(repo, filter)} />
              </>
            }
          />
        )}
      </main>
    </>
  );
}
