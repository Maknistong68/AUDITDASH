'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CodeChip } from '@/components/details/parts';
import { CATEGORY_ICONS } from '@/components/charts/categoryIcons';
import { categoryById } from '@/lib/categories';
import type { AuditDraft } from '@/lib/input/model';
import { SUB_LABELS, type LiveScore } from '@/lib/input/score';
import { calm, QUICK, RISE, STAGGER } from '@/lib/motion';
import type { CategoryId, Compliance, TypeSection, TypedChecklistItem } from '@/lib/types';
import type { WizardActions } from './AuditWizard';
import { ScorePanel } from './ScorePanel';
import { AnswerControl } from './ui';

type Filter = 'all' | 'open' | 'findings';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Unanswered' },
  { id: 'findings', label: 'Findings' },
];

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ');

/**
 * Step 3: every question by section (H&S: B and C also by subsection), its weight and category, a Full / Partial /
 * No / N/A control and a note. Quick filters (unanswered, findings = Partial or No) and search; which rows a filter
 * shows is fixed when it is chosen, so answering never makes a row jump away. The live score sits beside the list.
 */
export function ChecklistStep({ draft, items, sections, actions, score }: {
  draft: AuditDraft; items: TypedChecklistItem[]; sections: TypeSection[]; actions: WizardActions; score: LiveScore;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [frozen, setFrozen] = useState<Record<string, Compliance>>(draft.answers);
  const [opened, setOpened] = useState<Set<string>>(() => new Set());

  const noteOf = useMemo(() => {
    const m = new Map<string, { text: string; more: number }>();
    for (const n of draft.notes) {
      if (n.kind !== 'finding' || !n.code) continue;
      const x = m.get(n.code);
      if (x) x.more++; else m.set(n.code, { text: n.text, more: 0 });
    }
    return m;
  }, [draft.notes]);

  const pick = (f: Filter) => { setFrozen(draft.answers); setFilter(f); };

  const visible = useMemo(() => {
    const q = norm(query.trim());
    return items.filter((i) => {
      const a = frozen[i.code];
      if (filter === 'open' && a) return false;
      if (filter === 'findings' && a !== 'partial' && a !== 'no') return false;
      if (!q) return true;
      return norm(`${i.code} ${i.question} ${noteOf.get(i.code)?.text ?? ''}`).includes(q);
    });
    // noteOf is read only for search; the filter set stays fixed while typing notes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, filter, query, frozen]);

  const groups = useMemo(() => {
    // H&S B and C: a section heading, then one card per subsection; everything else: one card per section.
    const out: { key: string; title: string; items: TypedChecklistItem[] }[] = [];
    let section: string | null = null;
    for (const i of visible) {
      const secTitle = sections.find((s) => s.code === i.section)?.title ?? i.section;
      const sub = draft.type === 'hs' && i.subsection ? i.subsection : null;
      if (i.section !== section) {
        section = i.section;
        if (sub) out.push({ key: i.section, title: secTitle, items: [] });
      }
      const key = sub ?? i.section;
      let g = out[out.length - 1];
      if (!g || g.key !== key) {
        g = { key, title: sub ? SUB_LABELS[sub] ?? sub : secTitle, items: [] };
        out.push(g);
      }
      g.items.push(i);
    }
    return out;
  }, [visible, sections, draft.type]);

  const counts: Record<Filter, number> = {
    all: items.length,
    open: score.counts.unanswered,
    findings: score.counts.findings,
  };

  return (
    <div className="flex flex-col gap-[var(--gap-grid)]">
      <motion.header {...RISE} transition={calm()} className="flex flex-col gap-1 pt-2">
        <h1 className="text-[clamp(26px,3.8svh,36px)] font-semibold leading-[1.05] tracking-[-0.035em]">Checklist</h1>
      </motion.header>

      <div className="sticky top-[calc(var(--topbar-h,var(--topbar))+8px)] z-10 min-[1100px]:hidden">
        <ScorePanel score={score} reported={draft.reportedScore} compact />
      </div>

      <div className="grid grid-cols-1 items-start gap-[var(--gap-grid)] min-[1100px]:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-[var(--gap-grid)]">
          <motion.div {...RISE} transition={calm(STAGGER)} className="flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label="Show" className="flex rounded-full bg-fill-2 p-1">
              {FILTERS.map((f) => {
                const on = f.id === filter;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    data-filter={f.id}
                    onClick={() => pick(f.id)}
                    className={`relative h-8 rounded-full px-3 text-[13px] font-semibold transition-colors duration-300 ${on ? 'text-ink' : 'text-muted hover:text-ink'}`}
                  >
                    {on && <motion.span layoutId="filter-pill" transition={QUICK} className="absolute inset-0 rounded-full bg-surface shadow-[var(--shadow-card)]" />}
                    <span className="relative">{f.label} <span className="num font-normal text-faint">{counts[f.id]}</span></span>
                  </button>
                );
              })}
            </div>
            <label className="relative ml-auto flex min-w-0 flex-1 items-center min-[700px]:max-w-[320px]">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search questions"
                aria-label="Search questions"
                data-testid="checklist-search"
                className="h-10 w-full rounded-full bg-fill-2 pl-4 pr-9 text-[14px] outline-none transition-shadow placeholder:text-faint focus:shadow-[0_0_0_2px_var(--accent)]"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} className="tap absolute right-2 grid size-6 place-items-center rounded-full text-muted hover:bg-fill" aria-label="Clear search" data-tip="Clear search">
                  <X size={14} aria-hidden />
                </button>
              )}
            </label>
          </motion.div>

          {groups.length === 0 && (
            <p className="card px-6 py-12 text-center text-[15px] text-muted" data-testid="checklist-empty">Nothing here.</p>
          )}

          {groups.map((g, gi) => (
            <motion.section
              key={`${filter}-${g.key}`}
              {...RISE}
              transition={calm(Math.min(gi, 6) * STAGGER)}
              aria-label={g.title}
              className={g.items.length ? 'card overflow-hidden' : 'pt-3'}
            >
              <h2 className={g.items.length ? 'flex items-center gap-2 border-b border-[var(--hairline)] px-[clamp(14px,1.6vw,22px)] py-3 text-[14px] font-semibold' : 'flex items-center gap-2.5 px-1 text-[17px] font-semibold tracking-[-0.02em]'}>
                <CodeChip code={g.key} />
                <span className="min-w-0 truncate">{g.title}</span>
              </h2>
              {g.items.length > 0 && (
                <ul className="divide-y divide-[var(--hairline)]">
                  {g.items.map((i) => (
                    <Question
                      key={i.code}
                      item={i}
                      hs={draft.type === 'hs'}
                      value={draft.answers[i.code]}
                      note={noteOf.get(i.code)}
                      open={opened.has(i.code)}
                      onOpen={() => setOpened((s) => new Set(s).add(i.code))}
                      actions={actions}
                    />
                  ))}
                </ul>
              )}
            </motion.section>
          ))}
        </div>

        <motion.aside {...RISE} transition={calm(STAGGER * 2)} className="sticky top-[calc(var(--topbar-h,var(--topbar))+16px)] hidden min-[1100px]:block">
          <ScorePanel score={score} reported={draft.reportedScore} />
        </motion.aside>
      </div>
    </div>
  );
}

function Question({ item, hs, value, note, open, onOpen, actions }: {
  item: TypedChecklistItem; hs: boolean; value: Compliance | undefined; note: { text: string; more: number } | undefined;
  open: boolean; onOpen: () => void; actions: WizardActions;
}) {
  const cat = hs ? categoryById(item.category as CategoryId) : null;
  const Icon = cat ? CATEGORY_ICONS[cat.icon] : null;
  const showNote = open || !!note;
  return (
    <li className="flex flex-col gap-3 px-[clamp(14px,1.6vw,22px)] py-4" data-testid="question" data-code={item.code}>
      <div className="flex flex-col gap-3 min-[700px]:flex-row min-[700px]:items-start min-[700px]:justify-between min-[700px]:gap-6">
        <div className="flex min-w-0 gap-3">
          <CodeChip code={item.code} className="mt-[2px] h-fit shrink-0" />
          <div className="min-w-0">
            <p className="text-[15px] leading-snug">{item.question}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-faint">
              <span className="num">Weight {item.weight}</span>
              {cat && (
                <span className="inline-flex items-center gap-1">
                  {Icon && <Icon size={12} strokeWidth={2.4} style={{ color: cat.color }} aria-hidden />}
                  {cat.short}
                </span>
              )}
              {!showNote && (
                <button type="button" onClick={onOpen} className="inline-flex items-center gap-1 rounded-md font-semibold text-[var(--accent)] hover:underline" data-testid="add-note"> Note
                </button>
              )}
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <AnswerControl code={item.code} value={value} onChange={(v) => actions.setAnswer(item.code, v)} />
        </div>
      </div>
      <AnimatePresence initial={false}>
        {showNote && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto', transition: QUICK }}
            exit={{ opacity: 0, height: 0, transition: QUICK }}
            className="overflow-hidden min-[700px]:pl-[52px]"
          >
            <textarea
              value={note?.text ?? ''}
              onChange={(e) => actions.setItemNote(item.code, e.target.value)}
              autoFocus={open && !note}
              rows={2}
              placeholder="Observation"
              aria-label={`Note for ${item.code}`}
              data-testid="question-note"
              className="max-h-[220px] min-h-[44px] w-full resize-y rounded-xl bg-fill-2 px-3.5 py-2.5 text-[14px] leading-relaxed outline-none transition-shadow [field-sizing:content] placeholder:text-faint focus:shadow-[0_0_0_2px_var(--accent)]"
            />
            {note && note.more > 0 && <p className="mt-1 text-[12px] text-faint">+{note.more} more note{note.more > 1 ? 's' : ''} in Review</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
