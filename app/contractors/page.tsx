import type { Metadata } from 'next';
import Link from 'next/link';
import { getRepo } from '@/lib/data/repo';
import { regionHistory } from '@/lib/analytics';
import { bandFor } from '@/lib/scoring';
import { bandShort, bandTone, pct } from '@/lib/format';
import { detailContext, href, type SP } from '@/lib/details';
import { QUARTERS } from '@/lib/filters';
import { BentoCard } from '@/components/bento/BentoGrid';
import { DetailFrame, PageTitle } from '@/components/details/DetailFrame';

export const metadata: Metadata = { title: 'Contractors' };

/**
 * The contractor register (data/contractors.csv) as it stands after the import: every contractor with its status, its
 * sub-region in each quarter (the sheet its audit was filed under; a move is highlighted), its audits and latest score.
 * Inactive contractors are listed last, dimmed: off the ranking, history kept.
 */
export default async function ContractorsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { filter, query } = detailContext(await searchParams);
  const repo = await getRepo();
  const rows = repo.contractors().map((c) => {
    const audits = repo.audits().filter((a) => a.contractorId === c.id).sort((a, b) => a.date.localeCompare(b.date));
    const hist = new Map(regionHistory(repo, c.id).map((h) => [h.quarter, h.regions]));
    return { c, audits, hist, latest: audits.at(-1) ?? null };
  });
  const ordered = [...rows.filter((r) => r.c.active), ...rows.filter((r) => !r.c.active)];
  const active = rows.filter((r) => r.c.active).length;
  const cols = { gridTemplateColumns: `minmax(0,1.6fr) repeat(${QUARTERS.length}, minmax(4.2em,0.5fr)) minmax(7em,0.9fr) 5.5em` };

  return (
    <DetailFrame filter={filter} crumbs={[{ label: 'Overview', href: `/?${query}` }, { label: 'Contractors' }]} parent={`/?${query}`}>
      <div className="flex flex-col gap-[var(--gap-grid)] px-[var(--gutter)]">
        <PageTitle meta={`${active} active${rows.length > active ? ` · ${rows.length - active} inactive` : ''}`}>Contractors</PageTitle>
        <BentoCard i={0} testid="contractor-register" className="overflow-x-auto px-[clamp(8px,1vw,18px)] py-[clamp(10px,1.6svh,20px)]">
          <div style={cols} className={`grid min-w-[620px] items-center gap-x-4 px-3 pb-2 text-[12px] font-semibold text-faint`}>
            <span />
            {QUARTERS.map((q) => <span key={q} className="text-center">{q.replace('-', ' ')}</span>)}
            <span>Latest</span>
            <span />
          </div>
          <ul className="flex min-w-[620px] flex-col">
            {ordered.map(({ c, audits, hist, latest }) => {
              let prev: string | null = null;
              const band = latest ? bandFor(latest.totalScore) : null;
              return (
                <li key={c.id} data-testid="register-row" data-active={c.active ? '' : undefined} className={c.active ? '' : 'opacity-50'}>
                  <Link
                    href={href(`/contractor/${c.id}`, query)}
                    style={cols}
                    className={`grid items-center gap-x-4 rounded-[12px] px-3 py-[clamp(8px,1.3svh,13px)] transition-colors duration-500 hover:bg-fill-2`}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[15px] font-semibold">{c.name}</span>
                      <span className="text-[12px] text-muted">{c.contractNo}{c.active ? '' : ' · Inactive'}</span>
                    </span>
                    {QUARTERS.map((q) => {
                      const regions = hist.get(q);
                      const label = regions?.join(' · ') ?? null;
                      const moved = label !== null && prev !== null && label !== prev;
                      if (label !== null) prev = label;
                      return (
                        <span key={q} className="flex justify-center" data-testid="register-region" data-moved={moved ? '' : undefined}>
                          {label === null ? (
                            <span className="text-faint">—</span>
                          ) : (
                            <span
                              className="rounded-full px-2.5 py-[2px] text-[12.5px] font-semibold"
                              style={moved ? { background: 'var(--accent)', color: 'var(--on-accent)' } : { background: 'var(--fill)' }}
                              title={moved ? 'Moved this quarter' : undefined}
                            >
                              {label}
                            </span>
                          )}
                        </span>
                      );
                    })}
                    <span className={`flex items-center gap-2 ${band ? `tone-${bandTone(band)}` : ''}`}>
                      {latest ? (
                        <>
                          <span className="num w-[2.4em] text-right text-[15px] font-semibold">{pct(latest.totalScore)}%</span>
                          <span className="h-[6px] flex-1 overflow-hidden rounded-full bg-fill-2">
                            <span className="block h-full rounded-full" style={{ width: `${latest.totalScore * 100}%`, background: 'var(--tone-dot)' }} />
                          </span>
                        </>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </span>
                    <span className="text-right text-[12.5px] text-muted">
                      {band ? bandShort(band) : 'No audit'}
                      <span className="block num">{audits.length} {audits.length === 1 ? 'audit' : 'audits'}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </BentoCard>
      </div>
    </DetailFrame>
  );
}
