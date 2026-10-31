'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { CATEGORY_ICONS } from '@/components/charts/categoryIcons';
import { CATEGORIES, categoryById } from '@/lib/categories';
import { calm, QUICK } from '@/lib/motion';
import type { CategoryId, Compliance } from '@/lib/types';

export const ANSWERS: { id: Compliance; label: string; tone: string }[] = [
  { id: 'full', label: 'Full', tone: 'tone-good' },
  { id: 'partial', label: 'Partial', tone: 'tone-partial' },
  { id: 'no', label: 'No', tone: 'tone-non' },
  { id: 'na', label: 'N/A', tone: '' },
];

/**
 * Full / Partial / No / N/A for one question: a radio group whose selected pill glides between options (QUICK).
 * Each option takes its status tone; N/A is neutral. Clicking the selected option again clears it.
 */
export function AnswerControl({ code, value, onChange }: { code: string; value: Compliance | undefined; onChange: (v: Compliance | undefined) => void }) {
  return (
    <div role="radiogroup" aria-label={`Compliance for ${code}`} className="grid h-9 w-full grid-cols-4 rounded-full bg-fill-2 p-[3px] min-[700px]:w-[272px]">
      {ANSWERS.map((a) => {
        const on = value === a.id;
        return (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={on}
            data-answer={a.id}
            onClick={() => onChange(on ? undefined : a.id)}
            className={`relative rounded-full text-[13px] font-semibold transition-colors duration-300 ${a.tone} ${on ? '' : 'text-muted hover:text-ink'}`}
          >
            {on && (
              <motion.span
                layoutId={`ans-${code}`}
                transition={QUICK}
                className="absolute inset-0 rounded-full"
                style={{ background: a.tone ? 'var(--tone-bg)' : 'var(--surface)', boxShadow: a.tone ? 'none' : 'var(--shadow-card)' }}
              />
            )}
            <span className="relative" style={on && a.tone ? { color: 'var(--tone)' } : undefined}>{a.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** A 0..1 bar that glides to its value on the house curve whenever it changes. */
export function Bar({ value, color = 'var(--bar)', delay = 0, className = 'h-[7px]' }: { value: number | null; color?: string; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  const w = value === null || !Number.isFinite(value) ? 0 : Math.min(1, Math.max(0, value));
  return (
    <span className={`relative block w-full overflow-hidden rounded-full bg-fill-2 ${className}`} aria-hidden>
      <motion.span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ background: color }}
        initial={reduce ? false : { width: 0 }}
        animate={{ width: `${w * 100}%` }}
        transition={calm(delay)}
      />
    </span>
  );
}

/** Category picker that looks like the app's category chip (icon in the category hue); native select underneath. */
export function CategorySelect({ value, onChange, auto, label }: { value: CategoryId; onChange: (c: CategoryId) => void; auto: CategoryId | null; label: string }) {
  const c = categoryById(value);
  const Icon = CATEGORY_ICONS[c.icon];
  const changed = auto !== null && auto !== value;
  return (
    <label className="relative inline-flex max-w-full items-center gap-1.5 rounded-full bg-fill-2 py-1 pl-2 pr-7 text-[13px] font-semibold transition-colors hover:bg-fill">
      {Icon && <Icon size={14} strokeWidth={2.4} style={{ color: c.color }} aria-hidden />}
      <span className="truncate">{c.short}</span>
      {changed && <span className="text-[11px] font-medium text-faint">· edited</span>}
      <ChevronDown size={14} strokeWidth={2.4} className="pointer-events-none absolute right-2 text-faint" aria-hidden />
      <select
        aria-label={label}
        data-testid="category-select"
        value={value}
        onChange={(e) => onChange(e.target.value as CategoryId)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {CATEGORIES.map((x) => (
          <option key={x.id} value={x.id}>{x.name}{x.id === auto ? ' (auto)' : ''}</option>
        ))}
      </select>
    </label>
  );
}

/** Labelled form field wrapper. */
export function Field({ label, children, hint, className = '' }: { label: string; children: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="text-[13px] font-semibold text-muted">{label}</span>
      {children}
      {hint && <span className="text-[12px] text-faint">{hint}</span>}
    </label>
  );
}

export const INPUT =
  'h-11 w-full min-w-0 rounded-xl bg-fill-2 px-3.5 text-[15px] text-ink outline-none ring-0 transition-shadow placeholder:text-faint focus:shadow-[0_0_0_2px_var(--accent)]';

export function Button({
  children, onClick, kind = 'plain', disabled, testid, type = 'button', title,
}: {
  children: React.ReactNode; onClick?: () => void; kind?: 'primary' | 'plain' | 'ghost'; disabled?: boolean; testid?: string; type?: 'button' | 'submit'; title?: string;
}) {
  const cls = {
    primary: 'bg-[var(--accent)] text-[var(--on-accent)] hover:brightness-110',
    plain: 'bg-fill text-ink hover:bg-[var(--control)]',
    ghost: 'text-muted hover:bg-fill-2 hover:text-ink',
  }[kind];
  return (
    <button
      type={type}
      title={title}
      data-testid={testid}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[14px] font-semibold transition-[filter,background-color,color,opacity] duration-300 motion-safe:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 ${cls}`}
    >
      {children}
    </button>
  );
}
