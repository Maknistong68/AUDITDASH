import { getRepo } from '@/lib/data/repo';
import { parseFilter, filterToQuery } from '@/lib/filters';
import { categoryDetail, categoryGaps, league, portfolioSummary } from '@/lib/analytics';
import { CATEGORIES } from '@/lib/categories';
import type { CategoryId, Filter } from '@/lib/types';
import { TopBar } from '@/components/shell/TopBar';
import { ScoreBlock } from '@/components/shell/ScoreBlock';
import { EmptyState } from '@/components/shell/EmptyState';
import { GapRadar, type WorstContractor } from '@/components/charts/GapRadar';
import { ContractorRace } from '@/components/charts/ContractorRace';

type SP = Record<string, string | string[] | undefined>;

function toSearchParams(sp: SP): URLSearchParams {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') out.set(k, v);
    else if (Array.isArray(v) && v.length) out.set(k, v[0]);
  }
  return out;
}

const SCOPE: Record<Filter['quarter'], string> = { 'Q4-2025': 'Q4 2025', 'Q1-2026': 'Q1 2026', all: 'All quarters' };

export default async function PortfolioPage({ searchParams }: { searchParams: Promise<SP> }) {
  const filter = parseFilter(toSearchParams(await searchParams));
  const repo = getRepo();
  const summary = portfolioSummary(repo, filter);
  const empty = summary.audits === 0;
  const gaps = empty ? [] : categoryGaps(repo, filter);
  const rows = empty ? [] : league(repo, filter);
  const worst: Partial<Record<CategoryId, WorstContractor[]>> = {};
  if (!empty) {
    for (const c of CATEGORIES) {
      worst[c.id] = categoryDetail(repo, filter, c.id).contractors.slice(0, 3)
        .map((x) => ({ id: x.contractor.id, name: x.contractor.name, gapRate: x.gapRate }));
    }
  }
  const query = filterToQuery(filter);
  const regions = filter.regions.join(' + ');

  return (
    <>
      <TopBar filter={filter} />
      {/* ≥1200px: one-viewport hero (score | gaps, race below). Narrower: sections stack and the page scrolls. */}
      <main
        data-testid="hero"
        className="flex flex-col px-[var(--gutter)] pb-[clamp(16px,3svh,40px)] min-[1200px]:h-[calc(100svh-var(--topbar))]"
      >
        {empty ? (
          <EmptyState />
        ) : (
          <>
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-x-[calc(var(--gutter)*1.5)] gap-y-10 pt-[clamp(12px,2.5svh,36px)] min-[1200px]:grid-cols-[38fr_62fr] min-[1200px]:grid-rows-[minmax(0,1fr)]">
              <ScoreBlock {...summary} scope={`${SCOPE[filter.quarter]} · ${regions}`} />
              <section aria-labelledby="gaps-title" className="flex min-h-[460px] min-w-0 flex-col min-[1200px]:min-h-0">
                <div className="flex items-baseline justify-between gap-4 pb-[clamp(6px,1.2svh,16px)]">
                  <h2 id="gaps-title" className="font-display text-[clamp(26px,3.6svh,40px)] leading-none tracking-[-0.01em]">
                    Where it fails
                  </h2>
                  <span className="kicker">Gap by category · worst first</span>
                </div>
                <GapRadar gaps={gaps} query={query} worst={worst} />
              </section>
            </div>
            <section
              aria-labelledby="race-title"
              className="mt-[clamp(14px,2.6svh,36px)] flex h-[clamp(170px,24svh,250px)] shrink-0 flex-col gap-2 border-t border-rule pt-[clamp(10px,1.8svh,20px)]"
            >
              <div className="flex items-baseline justify-between gap-4">
                <h2 id="race-title" className="kicker">Contractor race · latest audit score</h2>
                <span className="kicker inline-flex items-center gap-4">
                  <span className="inline-flex items-center gap-1.5"><span className="h-[2px] w-4 rounded-full bg-positive" aria-hidden />up since Q4</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-[2px] w-4 rounded-full bg-accent" aria-hidden />down</span>
                </span>
              </div>
              <div className="min-h-0 flex-1">
                <ContractorRace rows={rows} />
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}
