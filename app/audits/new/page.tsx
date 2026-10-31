import type { Metadata } from 'next';
import { AuditWizard } from '@/components/input/AuditWizard';
import { Breadcrumb } from '@/components/shell/Breadcrumb';
import { TopBar } from '@/components/shell/TopBar';
import { isAuditType } from '@/lib/auditTypeIds';
import { toSearchParams, type SP } from '@/lib/details';
import { filterToQuery, parseFilter } from '@/lib/filters';

export const metadata: Metadata = { title: 'New audit' };

/**
 * Enter an audit: upload the completed Excel checklist (read in the browser, photos never imported) or fill it in,
 * check the details and answers, categorise the observations, review the honest score, save / submit / download.
 * `?type=` preselects the audit type and keeps its tab active.
 */
export default async function NewAuditPage({ searchParams }: { searchParams: Promise<SP> }) {
  const params = toSearchParams(await searchParams);
  const type = params.get('type');
  const filter = parseFilter(params);
  if (isAuditType(type) && type !== 'hs') filter.type = type;
  return (
    <>
      <TopBar filter={filter} detail />
      <main id="main" data-testid="new-audit-page" className="flex min-h-[calc(100svh-var(--topbar))] flex-col pt-[clamp(8px,1.4svh,18px)]">
        <div className="px-[var(--gutter)] pb-[clamp(6px,1svh,12px)]">
          <Breadcrumb items={[{ label: 'Overview', href: `/?${filterToQuery(filter)}` }, { label: 'New audit' }]} />
        </div>
        <AuditWizard initialType={isAuditType(type) ? type : 'hs'} />
      </main>
    </>
  );
}
