import { ClipboardList } from 'lucide-react';
import { auditTypeInfo } from '@/lib/auditTypeIds';
import type { AuditType } from '@/lib/types';
import { NewAuditButton } from './NewAuditButton';

/** A type tab with no audits yet: its full name, one line, and the way in (+ New Audit). */
export function TypeEmpty({ type }: { type: AuditType }) {
  const info = auditTypeInfo(type);
  return (
    <section
      data-testid="type-empty"
      aria-labelledby="type-empty-title"
      className="flex flex-1 flex-col items-center justify-center gap-[clamp(14px,2.4svh,24px)] px-6 py-[clamp(40px,10svh,120px)] text-center"
    >
      <span className="grid size-[clamp(56px,8svh,76px)] place-items-center rounded-[20px] bg-fill text-muted" aria-hidden>
        <ClipboardList size={30} strokeWidth={1.8} />
      </span>
      <div className="flex flex-col gap-2">
        <p className="text-[15px] font-semibold text-muted">{info.label}</p>
        <h2 id="type-empty-title" className="text-[clamp(28px,4.4svh,44px)] font-semibold leading-[1.05] tracking-[-0.035em]">No audits yet</h2>
        <p className="mx-auto max-w-[42ch] text-[15px] leading-snug text-muted">
          {info.label} audits entered here will fill this dashboard: score, main problem, trends and open actions.
        </p>
      </div>
      <NewAuditButton type={type} size="lg" />
    </section>
  );
}
