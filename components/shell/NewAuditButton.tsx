import Link from 'next/link';
import type { AuditType } from '@/lib/types';

/** Filled accent pill: where an auditor enters an audit for the current type. */
export function NewAuditButton({ type, size = 'sm' }: { type: AuditType | undefined; size?: 'sm' | 'lg' }) {
  const lg = size === 'lg';
  return (
    <Link
      href={`/audits/new?type=${type ?? 'hs'}`}
      data-testid={lg ? 'new-audit-cta' : 'new-audit'}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-ink font-semibold text-ground transition-[filter,transform] hover:brightness-90 motion-safe:active:scale-[0.97] ${
        lg ? 'h-10 px-5 text-[14px]' : 'h-8 pl-3 pr-3.5 text-[13px]'
      }`}
    >
      New audit
    </Link>
  );
}
