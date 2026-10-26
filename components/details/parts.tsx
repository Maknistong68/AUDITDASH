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
  finding: { label: 'Finding', cls: 'tone-non badge' },
  clear: { label: 'Clear', cls: 'tone-good badge' },
  na: { label: 'N/A', cls: 'badge bg-fill-2 text-muted' },
};

/** Finding / Clear / N/A pill. Only "Clear" is green. */
export function StatePill({ state }: { state: ItemState }) {
  const s = STATE[state];
  return <span data-state={state} className={`${s.cls} px-2 py-[2px] text-[12px]`} style={state === 'na' ? { background: 'var(--fill-2)', color: 'var(--muted)' } : undefined}>{s.label}</span>;
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
