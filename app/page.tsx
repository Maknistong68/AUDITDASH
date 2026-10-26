import { getRepo } from '@/lib/data/repo';
import { toSearchParams, type SP } from '@/lib/details';
import { QUARTERS, filterToQuery, parseFilter } from '@/lib/filters';
import {
  bandDistribution, categoryGaps, compareContractors, contractorCards, filterAudits, highRiskCount, mainProblem, portfolioSummary,
  regionComparison, repeatFindings, topIssues,
} from '@/lib/analytics';
import { MAX_COMPARE } from '@/lib/compare';
import { bandFor } from '@/lib/scoring';
import { TopBar } from '@/components/shell/TopBar';
import { EmptyState } from '@/components/shell/EmptyState';
import type { CompareEntry } from '@/components/sections/CompareTray';
import { BentoGrid } from '@/components/bento/BentoGrid';
import { GapRadar } from '@/components/charts/GapRadar';
import { MainIssues } from '@/components/sections/MainIssues';
import { AuditReel } from '@/components/sections/AuditReel';
import { SectionHead } from '@/components/sections/SectionHead';
import { ContractorsCard } from '@/components/bento/ContractorsCard';
import { MainProblemCard } from '@/components/bento/MainProblemCard';
import { ScoreCard } from '@/components/bento/ScoreCard';
import { RepeatsCard } from '@/components/bento/RepeatsCard';
import { HighRiskCard } from '@/components/bento/HighRiskCard';
import { BandsCard } from '@/components/bento/BandsCard';
import { RegionCard } from '@/components/bento/RegionCard';

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
  const query = filterToQuery(filter);
  const audits = empty ? [] : filterAudits(repo, filter);
  const contractorsById = new Map(repo.contractors().map((c) => [c.id, c]));
  const auditsByQuarter = Object.fromEntries(QUARTERS.map((q) => [q, audits.filter((a) => a.quarter === q).length])) as Record<(typeof QUARTERS)[number], number>;
  const reel = [...audits]
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .map((a) => {
      const c = contractorsById.get(a.contractorId)!;
      return { id: a.id, date: a.date, score: a.totalScore, band: bandFor(a.totalScore), contractor: c.name, region: c.subregion, quarter: a.quarter };
    });
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
                      query={query}
                    />
                  )}
                  <ScoreCard avgScore={summary.avgScore} band={summary.band} delta={summary.delta} audits={summary.audits} quarter={filter.quarter} byQuarter={byQuarter} />
                  <RepeatsCard repeats={repeats ? repeats.length : null} top={topRepeats} />
                  <HighRiskCard count={highRiskCount(repo, filter)} />
                  <BandsCard bands={bandDistribution(repo, filter)} />
                  <RegionCard rows={regionComparison(repo, filter)} quarter={filter.quarter} />
                </>
              }
            />
          )}
        </div>
        {/* Below the fold: where it fails, main issues, past-audit reel. Hidden when the filter is empty. */}
        {!empty && (
          <div className="flex flex-col gap-[clamp(56px,8svh,112px)] px-[var(--gutter)] pb-[clamp(64px,10svh,128px)] pt-[clamp(28px,5svh,64px)]">
            <section aria-labelledby="gaps-title" className="scroll-mt-[calc(var(--topbar)+24px)]">
              <SectionHead id="gaps-title" title="Where it fails" note={filter.quarter === 'Q1-2026' ? 'Score lost per category · worst first · Δ vs Q4' : 'Score lost per category · worst first'} />
              <GapRadar gaps={categoryGaps(repo, filter)} query={query} />
            </section>
            <section aria-labelledby="issues-title" className="scroll-mt-[calc(var(--topbar)+24px)]" data-testid="main-issues">
              <SectionHead id="issues-title" title="Main issues" note="Most score lost · share of audits noting each item" />
              <MainIssues rows={topIssues(repo, filter, 6)} auditsByQuarter={auditsByQuarter} query={query} />
            </section>
            <section aria-labelledby="reel-title" className="scroll-mt-[calc(var(--topbar)+24px)]">
              <AuditReel audits={reel} />
            </section>
          </div>
        )}
      </main>
    </>
  );
}
