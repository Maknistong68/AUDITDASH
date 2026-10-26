import { getRepo } from '@/lib/data/repo';
import { parseFilter } from '@/lib/filters';
import { bandDistribution, compareContractors, contractorCards, highRiskCount, portfolioSummary, repeatFindings } from '@/lib/analytics';
import { MAX_COMPARE } from '@/lib/compare';
import { TopBar } from '@/components/shell/TopBar';
import { EmptyState } from '@/components/shell/EmptyState';
import { TopStrip } from '@/components/sections/TopStrip';
import { Scoreboard } from '@/components/sections/Scoreboard';
import type { CompareEntry } from '@/components/sections/CompareTray';

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

  // Compare data for every card, so selecting is instant (selection itself lives in ?c= on the client).
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

  return (
    <>
      <TopBar filter={filter} />
      {/* ≥1200px: one-viewport hero (strip + 2-row scoreboard). Narrower: sections stack and the page scrolls. */}
      <main
        data-testid="hero"
        className="flex flex-col gap-[clamp(12px,2svh,24px)] px-[var(--gutter)] pb-[clamp(14px,2.4svh,32px)] pt-[clamp(6px,1.2svh,16px)] min-[1200px]:h-[calc(100svh-var(--topbar))]"
      >
        {empty ? (
          <EmptyState />
        ) : (
          <>
            <TopStrip
              avgScore={summary.avgScore}
              band={summary.band}
              delta={summary.delta}
              audits={summary.audits}
              bands={bandDistribution(repo, filter)}
              repeats={filter.quarter === 'Q4-2025' ? null : repeatFindings(repo, filter).length}
              highRisk={highRiskCount(repo, filter)}
              quarter={filter.quarter}
            />
            <Scoreboard cards={cards} compare={compare} />
          </>
        )}
      </main>
    </>
  );
}
