'use client';
import { RotateCcw } from 'lucide-react';
import { CATEGORY_ICONS } from '@/components/charts/categoryIcons';
import { categoryById } from '@/lib/categories';
import { KIND_LABEL, highlight, type LogKind } from '@/lib/log';
import type { CategoryId } from '@/lib/types';

/** Text with the search terms wrapped in <mark>. */
export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  return (
    <>
      {highlight(text, terms).map((s, i) =>
        s.hit ? (
          <mark key={i} className="rounded-[3px] bg-[color-mix(in_srgb,var(--accent)_30%,transparent)] px-[1px] text-inherit">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

/** Tone of each kind: findings red, site orange, notes neutral, positives green. */
export const KIND_TONE: Record<LogKind, string> = { finding: 'tone-non', site: 'tone-minimal', note: '', positive: 'tone-good' };

/** Kind as a small badge with a dot. */
export function KindPill({ kind }: { kind: LogKind }) {
  const neutral = kind === 'note';
  return (
    <span
      data-testid="log-kind"
      data-kind={kind}
      className={`${KIND_TONE[kind]} ${neutral ? 'bg-fill-2 text-muted' : 'badge'} inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-[2px] text-[12px] font-semibold`}
    >
      <span className="size-[6px] rounded-full" style={{ background: neutral ? 'var(--faint)' : 'var(--tone-dot)' }} aria-hidden />
      {KIND_LABEL[kind]}
    </span>
  );
}

/** Category icon in its hue + short name. */
export function CategoryTag({ id, className = '' }: { id: CategoryId; className?: string }) {
  const c = categoryById(id);
  const Icon = CATEGORY_ICONS[c.icon];
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`} title={c.name}>
      {Icon && <Icon size={13} strokeWidth={2.4} style={{ color: c.color }} className="shrink-0" aria-hidden />}
      <span className="truncate">{c.short}</span>
    </span>
  );
}

/** The hover affordance of a row: hidden until hover/focus on pointer devices, always shown on touch. */
export function OpenHint({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-flex items-center gap-1 whitespace-nowrap text-[13px] font-semibold text-[var(--accent)] transition-[opacity,transform] duration-[450ms] ease-[cubic-bezier(0.16,1,0.3,1)] [@media(hover:hover)]:-translate-x-1 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:translate-x-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:translate-x-0 [@media(hover:hover)]:group-focus-within:opacity-100 ${className}`}
    >
      Open
    </span>
  );
}

/** Nothing matches the search: the house empty state, with one action. */
export function LogEmpty({ onClear }: { onClear: () => void }) {
  return (
    <div data-testid="empty-state" className="flex flex-col items-center justify-center gap-4 px-6 py-[clamp(48px,10svh,120px)] text-center">
      <p className="figure text-[clamp(72px,12svh,128px)] text-faint" aria-hidden>0</p>
      <h2 className="text-[21px] font-semibold tracking-[-0.02em]">Nothing matches</h2>
      <p className="max-w-[36ch] text-[14px] text-muted">Try fewer words or loosen a filter.</p>
      <button
        type="button"
        onClick={onClear}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-[14px] font-semibold text-ground transition-transform motion-safe:active:scale-[0.97]"
      >
        <RotateCcw size={15} aria-hidden />
        Clear all
      </button>
    </div>
  );
}
