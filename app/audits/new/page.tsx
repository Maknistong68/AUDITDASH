import type { Metadata } from 'next';
import { TopBar } from '@/components/shell/TopBar';
import { auditTypeInfo, isAuditType } from '@/lib/auditTypeIds';
import { toSearchParams, type SP } from '@/lib/details';
import { parseFilter } from '@/lib/filters';

export const metadata: Metadata = { title: 'New audit' };

/** Placeholder until the audit wizard lands (Task 13). `?type=` preselects the type and keeps its tab active. */
export default async function NewAuditPage({ searchParams }: { searchParams: Promise<SP> }) {
  const params = toSearchParams(await searchParams);
  const type = params.get('type');
  const filter = parseFilter(params);
  if (isAuditType(type) && type !== 'hs') filter.type = type;
  const info = auditTypeInfo(filter.type);
  return (
    <>
      <TopBar filter={filter} detail />
      <main data-testid="new-audit-page" className="flex min-h-[calc(100svh-var(--topbar))] flex-col items-center justify-center gap-3 px-[var(--gutter)] text-center">
        <p className="text-[15px] font-semibold text-muted">{info.label}</p>
        <h1 className="text-[clamp(28px,4svh,40px)] font-semibold tracking-[-0.03em]">New audit — coming in this release</h1>
      </main>
    </>
  );
}
