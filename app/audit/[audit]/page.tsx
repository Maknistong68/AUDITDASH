import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getRepo } from '@/lib/data/repo';
import { auditReport, contractorAudits } from '@/lib/analytics';
import { CATEGORIES } from '@/lib/categories';
import { detailContext, href, toSearchParams, type SP } from '@/lib/details';
import { bandTone, dateLabel, pct, quarterLabel } from '@/lib/format';
import { findCategory, safeDecode } from '@/lib/routeParams';
import { bandFor } from '@/lib/scoring';
import type { CategoryId } from '@/lib/types';
import { BentoCard, TileLabel } from '@/components/bento/BentoGrid';
import { ScoreBar } from '@/components/bento/parts';
import { CATEGORY_ICONS } from '@/components/charts/categoryIcons';
import { DetailFrame } from '@/components/details/DetailFrame';
import { AuditDelta } from '@/components/details/parts';
import { CategoryGroup, Entry } from '@/components/report/ObservationList';
import { PrintButton } from '@/components/report/PrintButton';

type Params = { audit: string };

async function findAudit(raw: string) {
  const repo = await getRepo();
  const audit = repo.audits().find((a) => a.id === safeDecode(raw));
  const contractor = audit ? repo.contractors().find((c) => c.id === audit.contractorId) : undefined;
  return { repo, audit, contractor };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { audit, contractor } = await findAudit((await params).audit);
  return { title: audit && contractor ? `${contractor.name} · ${dateLabel(audit.date)} audit` : 'Not found' };
}


/**
 * The full audit report: header facts, the official score with its sections, and every observation, filterable by
 * category (?cat=) with negative observations (incl. site findings) and positive observations as tabs (?tab=).
 * Printing lays out both tabs in full, one after the other, on white.
 */
export default async function AuditReportPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<SP> }) {
  const { repo, audit, contractor } = await findAudit((await params).audit);
  if (!audit || !contractor) notFound();
  const sp = await searchParams;
  const { filter, query } = detailContext(sp);
  const raw = toSearchParams(sp);
  const tab: 'negative' | 'positive' = raw.get('tab') === 'positive' ? 'positive' : 'negative';
  const cat = findCategory(raw.get('cat') ?? '');

  const report = auditReport(repo, audit);
  const band = bandFor(audit.totalScore);
  const slide = contractorAudits(repo, filter, contractor.id).findIndex((r) => r.audit.id === audit.id);
  const contractorHref = href(`/contractor/${contractor.id}`, query, { s: slide });
  const crumbs = [
    { label: 'Overview', href: `/?${query}` },
    { label: contractor.name, href: contractorHref },
    { label: `Audit ${dateLabel(audit.date)}` },
  ];

  /** This page with the tab / category changed; the filter query is kept. */
  const link = (next: { tab?: 'negative' | 'positive'; cat?: CategoryId | null }) => {
    const p = new URLSearchParams(query);
    const t = next.tab ?? tab;
    const c = next.cat === undefined ? cat : next.cat;
    if (t === 'positive') p.set('tab', 'positive');
    if (c) p.set('cat', c);
    return `/audit/${encodeURIComponent(audit.id)}?${p}`;
  };

  const questions = new Map(repo.checklist().map((i) => [i.code, i.question]));
  const counts = new Map(CATEGORIES.map((c) => [c.id, report.negatives.filter((o) => o.category === c.id).length]));
  const groups = CATEGORIES.filter((c) => counts.get(c.id)! > 0).sort((a, b) => counts.get(b.id)! - counts.get(a.id)!);
  const tabs = [
    { id: 'negative' as const, label: 'Observations', n: report.negatives.length },
    { id: 'positive' as const, label: 'Positive observations', n: report.positives.length },
  ];

  return (
    <DetailFrame filter={filter} crumbs={crumbs} parent={contractorHref}>
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-[var(--gutter)] pb-[clamp(12px,2svh,22px)]">
        <div className="min-w-0">
          <h1 className="text-[24px] font-semibold leading-[1.05] tracking-[-0.035em] min-[900px]:text-[clamp(24px,3.6svh,32px)]">
            <Link href={contractorHref} data-testid="report-contractor" className="rounded-md transition-colors hover:text-[var(--accent)]">
              {contractor.name}
            </Link>
          </h1>
          <p className="mt-1.5 flex flex-wrap gap-x-2 text-[clamp(13px,1.6svh,15px)] text-muted" data-testid="report-facts">
            <span className="font-semibold text-ink">{dateLabel(audit.date)}</span>
            <span aria-hidden>·</span><span>{quarterLabel(audit.quarter)}</span>
            <span aria-hidden>·</span><span>{audit.subregion}</span>
          </p>
          <dl className="mt-0.5 flex flex-wrap gap-x-5 gap-y-0.5 text-[clamp(13px,1.6svh,15px)]">
            <div className="flex min-w-0 gap-2"><dt className="text-muted">Project</dt><dd className="min-w-0 break-words">{audit.location}</dd></div>
            <div className="flex min-w-0 gap-2"><dt className="text-muted">Auditors</dt><dd>{audit.auditors.join(', ')}</dd></div>
          </dl>
        </div>
        <PrintButton />
      </header>

      <div className="grid grid-cols-1 gap-[var(--gap-grid)] px-[var(--gutter)] min-[1100px]:grid-cols-12">
        <BentoCard i={0} testid="report-score" className={`tone-${bandTone(band)} gap-[clamp(12px,2svh,20px)] p-[clamp(16px,2.2svh,28px)] min-[1100px]:col-span-4`}>
          <div className="grid flex-1 content-between gap-[clamp(12px,2svh,20px)] ">
            <div className="flex flex-col gap-[clamp(12px,2svh,20px)]">
              <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                <p className="figure text-[clamp(72px,17svh,168px)]" data-testid="report-total">
                  {pct(audit.totalScore)}
                  <span className="ml-0.5 text-[0.42em] tracking-normal text-muted">%</span>
                </p>
                <div className="flex flex-col items-end gap-1.5 pb-[0.5em]">
                  <span className="badge px-2.5 py-[3px] text-[14px]" data-testid="report-band">{band}</span>
                  {report.previous && <AuditDelta audit={audit} previous={report.previous} />}
                </div>
              </div>
              <ScoreBar value={audit.totalScore} delay={0.15} />
              {/* Computed from the Excel points; the typed Excel total, when it differs, is shown as a quiet figure. */}
              {typeof audit.reportedScore === 'number' && pct(audit.reportedScore) !== pct(audit.totalScore) && (
                <p className="text-[13px] text-faint" data-testid="report-total-note" title={audit.issues?.join(' · ')}>
                  Excel <span className="num">{pct(audit.reportedScore)}%</span>
                </p>
              )}
            </div>
          </div>
        </BentoCard>

        <BentoCard i={1} testid="report-sections" className="gap-2 px-[clamp(10px,1vw,18px)] py-[clamp(14px,2svh,24px)] min-[1100px]:col-span-8">
          <TileLabel className="px-[clamp(6px,0.6vw,10px)]">
            Sections
          </TileLabel>
          <ul className="grid grid-cols-1 gap-x-[clamp(16px,2vw,40px)] min-[1100px]:grid-flow-col min-[1100px]:grid-cols-2 min-[1100px]:grid-rows-8">
            {report.sections.map((s) => (
              <li
                key={s.code}
                data-testid="section-row"
                data-code={s.code}
                className="grid grid-cols-[minmax(0,1fr)_3em] items-center min-[640px]:grid-cols-[minmax(0,1fr)_minmax(48px,0.8fr)_3em] gap-2.5 rounded-[10px] px-[clamp(6px,0.6vw,10px)] py-[clamp(4px,0.75svh,8px)]"
              >
                <span className="truncate text-[14px]">{s.label}</span>
                <span className="relative hidden h-[7px] overflow-hidden rounded-full bg-fill-2 min-[640px]:block" aria-hidden>
                  {s.ratio !== null && (
                    <span className="absolute inset-y-0 left-0 rounded-full bg-[var(--bar)]" style={{ width: `${Math.min(1, Math.max(0, s.ratio)) * 100}%` }} />
                  )}
                </span>
                <span className="num text-right text-[14px] font-semibold">
                  {s.ratio === null ? <span className="font-normal text-faint">N/A</span> : <>{pct(s.ratio)}<span className="text-[0.75em] text-muted">%</span></>}
                </span>
              </li>
            ))}
          </ul>
        </BentoCard>

        <BentoCard i={2} testid="report-observations" className="gap-[clamp(12px,1.8svh,20px)] px-[clamp(14px,1.4vw,28px)] py-[clamp(16px,2.2svh,28px)] min-[1100px]:col-span-12">
          <div role="tablist" aria-label="Observations" className="flex w-fit max-w-full flex-wrap items-center gap-[2px] rounded-full bg-fill p-[2px] print:hidden">
            {tabs.map((t) => {
              const on = t.id === tab;
              return (
                <Link
                  key={t.id}
                  href={link({ tab: t.id })}
                  scroll={false}
                  role="tab"
                  id={`tab-${t.id}`}
                  aria-selected={on}
                  aria-controls={`panel-${t.id}`}
                  data-testid={`tab-${t.id}`}
                  className={`inline-flex h-8 items-center gap-2 rounded-full px-4 text-[14px] transition-colors ${on ? 'bg-surface font-semibold text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.04)] dark:bg-[#636366]' : 'text-muted hover:text-ink'}`}
                >
                  {t.label}
                  <span className={`num text-[13px] ${on ? 'text-muted' : 'text-faint'}`}>{t.n}</span>
                </Link>
              );
            })}
          </div>

          {tab === 'negative' && (
            <nav aria-label="Filter by category" className="print:hidden">
              <ul className="flex flex-wrap gap-2">
                {[{ id: null, label: 'All', n: report.negatives.length, icon: null, color: undefined }, ...CATEGORIES.map((c) => ({ id: c.id, label: c.short, n: counts.get(c.id)!, icon: c.icon, color: c.color }))].map((chip) => {
                  const on = chip.id === cat;
                  const Icon = chip.icon ? CATEGORY_ICONS[chip.icon] : null;
                  const cls = `inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-colors ${
                    on ? 'bg-ink text-ground' : chip.n ? 'bg-fill-2 text-ink hover:bg-fill' : 'bg-fill-2 text-faint opacity-60'
                  }`;
                  const body = (
                    <>
                      {Icon && <Icon size={14} strokeWidth={2.4} style={{ color: on ? undefined : chip.color }} aria-hidden />}
                      {chip.label}
                      <span className={`num font-semibold ${on ? 'opacity-70' : 'text-faint'}`}>{chip.n}</span>
                    </>
                  );
                  return (
                    <li key={chip.id ?? 'all'}>
                      {chip.n || on ? (
                        <Link href={link({ cat: chip.id })} scroll={false} aria-current={on ? 'true' : undefined} data-testid="cat-chip" data-cat={chip.id ?? 'all'} className={cls}>
                          {body}
                        </Link>
                      ) : (
                        <span aria-disabled="true" data-testid="cat-chip" data-cat={chip.id} className={cls} title="No observations in this category">{body}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}

          <div role="tabpanel" id="panel-negative" aria-labelledby="tab-negative" data-testid="panel-negative" className={tab === 'negative' ? '' : 'hidden print:block'}>
            <h2 className="hidden pb-2 text-[20px] font-semibold tracking-[-0.02em] print:block">
              Observations <span className="num text-muted">{report.negatives.length}</span>
            </h2>
            {groups.length ? (
              <div className="columns-1 gap-[clamp(24px,2.8vw,56px)] min-[1100px]:columns-2 print:columns-1">
                {groups.map((c) => (
                  <CategoryGroup key={c.id} c={c} entries={report.negatives.filter((o) => o.category === c.id)} questions={questions} hidden={cat !== null && cat !== c.id} />
                ))}
              </div>
            ) : (
              <p className="text-[15px] text-muted">No observations in this audit.</p>
            )}
          </div>

          <div role="tabpanel" id="panel-positive" aria-labelledby="tab-positive" data-testid="panel-positive" className={tab === 'positive' ? '' : 'hidden print:block print:pt-4'}>
            <h2 className="hidden pb-2 text-[20px] font-semibold tracking-[-0.02em] print:block">
              Positive observations <span className="num text-muted">{report.positives.length}</span>
            </h2>
            {report.positives.length ? (
              <ul className="columns-1 gap-[clamp(24px,2.8vw,56px)] min-[1100px]:columns-2 print:columns-1">
                {report.positives.map((o) => <Entry key={o.id} o={o} />)}
              </ul>
            ) : (
              <p className="text-[15px] text-muted">No positive observations in this audit.</p>
            )}
          </div>
        </BentoCard>
      </div>
    </DetailFrame>
  );
}
