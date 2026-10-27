import { CATEGORY_ICONS } from '@/components/charts/categoryIcons';
import { Signed } from '@/components/bento/parts';
import { categoryById } from '@/lib/categories';
import { dateLabel } from '@/lib/format';
import type { Audit, CategoryId } from '@/lib/types';
import type { ItemState } from '@/lib/analytics';

/** Checklist code in a small filled chip (same as the main screen's driving items). */
export function CodeChip({ code, className = '' }: { code: string; className?: string }) {
  return (
    <span className={`num inline-block rounded-md bg-fill px-1.5 py-[1px] text-center text-[12px] font-semibold text-muted ${className}`}>{code}</span>
  );
}

/** Category name with its icon in the category hue. */
export function CategoryChip({ id, short = false }: { id: CategoryId; short?: boolean }) {
  const c = categoryById(id);
  const Icon = CATEGORY_ICONS[c.icon];
  return (
    <span data-testid="category-chip" className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-full bg-fill-2 py-1 pl-2 pr-3 text-[13px] font-semibold">
      {Icon && <Icon size={14} strokeWidth={2.4} style={{ color: c.color }} aria-hidden />}
      <span className="truncate">{short ? c.short : c.name}</span>
    </span>
  );
}

/** Δ in whole points vs the audit before it in time, named by that audit's date. */
export function AuditDelta({ audit, previous }: { audit: Audit; previous: Audit | null }) {
  if (!previous) return <span className="text-[13px] text-muted">First audit</span>;
  const d = Math.round(audit.totalScore * 100) - Math.round(previous.totalScore * 100);
  return (
    <span data-testid="slide-delta" className="inline-flex items-center gap-1 text-[13px]" title={`Previous audit ${dateLabel(previous.date)}: ${Math.round(previous.totalScore * 100)}%`}>
      <Signed d={d} />
      <span className="text-muted">vs {dateLabel(previous.date, false)}</span>
    </span>
  );
}

const STATE: Record<ItemState, { label: string; cls: string }> = {
  noted: { label: 'Noted', cls: 'bg-fill text-ink' },
  none: { label: 'No finding', cls: 'bg-fill-2 text-muted' },
  na: { label: 'N/A', cls: 'bg-fill-2 text-faint' },
};

/**
 * Noted (a finding) / No finding / N/A. Severity is shown separately, from the official subsection score (SectionGap).
 */
export function StatePill({ state }: { state: ItemState }) {
  const s = STATE[state];
  return <span data-state={state} className={`${s.cls} inline-flex items-center whitespace-nowrap rounded-full px-2 py-[2px] text-[12px] font-semibold`}>{s.label}</span>;
}

/** Score lost in the item's official subsection for one audit (1 − scored/possible), in the single gap hue. */
export function SectionGap({ ratio }: { ratio: number | null }) {
  const gap = ratio === null ? null : 1 - ratio;
  return (
    <span className="grid grid-cols-[minmax(0,1fr)_3ch] items-center gap-2" data-testid="section-gap" title={gap === null ? 'Section not applicable' : `${Math.round(gap * 100)}% of the section's score lost in this audit`}>
      <GapBar value={gap} />
      <span className="num text-right text-[13px] font-semibold">{gap === null ? <span className="font-normal text-faint">—</span> : Math.round(gap * 100)}</span>
    </span>
  );
}

/** A gap bar on 0–100% in the single severity hue. */
export function GapBar({ value, className = '' }: { value: number | null; className?: string }) {
  return (
    <span className={`relative block h-[7px] overflow-hidden rounded-full bg-fill-2 ${className}`} aria-hidden>
      {value !== null && Number.isFinite(value) && (
        <span className="absolute inset-y-0 left-0 rounded-full bg-[var(--gap)]" style={{ width: `${Math.min(1, Math.max(0, value)) * 100}%` }} />
      )}
    </span>
  );
}
