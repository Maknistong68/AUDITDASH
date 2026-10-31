'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CodeChip } from '@/components/details/parts';
import { CATEGORY_ICONS } from '@/components/charts/categoryIcons';
import { CountUp } from '@/components/motion/CountUp';
import { CATEGORIES } from '@/lib/categories';
import { bandColor, bandTone, dateLabel, pct } from '@/lib/format';
import type { NoteKind } from '@/lib/input/categorise';
import type { AuditDraft, DraftNote } from '@/lib/input/model';
import { missingForSubmit, type LiveScore } from '@/lib/input/score';
import { calm, DUR, QUICK, RISE, STAGGER } from '@/lib/motion';
import type { CategoryId, Contractor, TypedChecklistItem } from '@/lib/types';
import type { WizardActions } from './AuditWizard';
import { Bar, Button, CategorySelect } from './ui';

const KINDS: { id: NoteKind; label: string }[] = [
  { id: 'finding', label: 'Finding' },
  { id: 'site', label: 'Site' },
  { id: 'positive', label: 'Positive' },
];
const SHOW: { id: 'all' | NoteKind; label: string }[] = [{ id: 'all', label: 'All' }, ...KINDS.map((k) => ({ ...k, label: k.id === 'finding' ? 'Item notes' : k.id === 'site' ? 'Site findings' : 'Positives' }))];
const fmtPct = (n: number) => String(Math.round(n * 100));
const SECTION_SHORT: Record<string, string> = { A: 'Management', B: 'Site processes', C: 'Planning', C1: 'Leadership', C2: 'Planning docs' };

/**
 * Step 4: the Part 3 notes as cards (kind, automatic category chip the auditor can change, text), add / remove; then
 * the review: score, band, sections, observations per category, the Excel total next to the honest total, and
 * Save draft / Submit / Download.
 */
export function ReviewStep({ draft, items, score, contractor, actions, onSave, onSubmit, onDownload, onNew, onGo }: {
  draft: AuditDraft; items: TypedChecklistItem[]; score: LiveScore; contractor: Contractor | null; actions: WizardActions;
  onSave: () => void; onSubmit: () => void; onDownload: () => void; onNew: () => void; onGo: (n: number) => void;
}) {
  const [show, setShow] = useState<'all' | NoteKind>('all');
  const questions = useMemo(() => new Map(items.map((i) => [i.code, i.question])), [items]);
  const notes = draft.notes.filter((n) => show === 'all' || n.kind === show);
  const counts = { all: draft.notes.length, finding: 0, site: 0, positive: 0 } as Record<'all' | NoteKind, number>;
  for (const n of draft.notes) counts[n.kind]++;
  const missing = missingForSubmit(draft, items);
  const submitted = draft.status === 'submitted';

  const perCat = CATEGORIES.map((c) => ({ c, n: draft.notes.filter((o) => o.kind !== 'positive' && o.text.trim() && o.category === c.id).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
  const maxCat = Math.max(1, ...perCat.map((x) => x.n));
  const differs = draft.reportedScore !== null && score.total !== null && Math.round(draft.reportedScore * 100) !== Math.round(score.total * 100);

  return (
    <div className="flex flex-col gap-[clamp(20px,3svh,36px)]">
      <motion.header {...RISE} transition={calm()} className="flex items-end justify-between gap-3 pt-2">
        <h1 className="text-[clamp(24px,3.6svh,32px)] font-semibold leading-[1.05] tracking-[-0.035em]">Observations</h1>
        <a href="#review" className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[14px] font-semibold text-[var(--accent)] hover:underline" data-testid="jump-review">
          Review <ArrowDown size={15} strokeWidth={2.4} aria-hidden />
        </a>
      </motion.header>

      <motion.div {...RISE} transition={calm(STAGGER)} className="flex flex-wrap items-center justify-between gap-2">
        <div role="radiogroup" aria-label="Show" className="flex max-w-full overflow-x-auto rounded-full bg-fill-2 p-1">
          {SHOW.map((f) => {
            const on = f.id === show;
            return (
              <button key={f.id} type="button" role="radio" aria-checked={on} onClick={() => setShow(f.id)}
                className={`relative h-8 shrink-0 rounded-full px-3 text-[13px] font-semibold transition-colors duration-300 ${on ? 'text-ink' : 'text-muted hover:text-ink'}`}>
                {on && <motion.span layoutId="note-filter" transition={QUICK} className="absolute inset-0 rounded-full bg-surface shadow-[var(--shadow-card)]" />}
                <span className="relative">{f.label} <span className="num font-normal text-faint">{counts[f.id]}</span></span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Button kind="plain" onClick={() => { actions.addNote('site'); setShow((s) => (s === 'all' || s === 'site' ? s : 'all')); }} testid="add-site">
            <Plus size={15} strokeWidth={2.6} aria-hidden /> Site finding
          </Button>
          <Button kind="plain" onClick={() => { actions.addNote('positive'); setShow((s) => (s === 'all' || s === 'positive' ? s : 'all')); }} testid="add-positive">
            <Plus size={15} strokeWidth={2.6} aria-hidden /> Positive
          </Button>
        </div>
      </motion.div>

      {notes.length === 0 ? (
        <p className="card px-6 py-12 text-center text-[15px] text-muted">No notes yet.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-[var(--gap-grid)] min-[1000px]:grid-cols-2 min-[1600px]:grid-cols-3" data-testid="note-cards">
          <AnimatePresence initial={false}>
            {notes.map((n, i) => (
              <NoteCard key={n.id} note={n} i={i} question={n.code ? questions.get(n.code) : undefined} actions={actions} />
            ))}
          </AnimatePresence>
        </ul>
      )}

      <motion.h2 {...RISE} transition={calm(STAGGER * 2)} id="review" className="scroll-mt-[calc(var(--topbar-h,var(--topbar))+16px)] pt-4 text-[clamp(24px,3.6svh,32px)] font-semibold leading-[1.05] tracking-[-0.035em]">Review</motion.h2>

      <div className="grid grid-cols-1 gap-[var(--gap-grid)] min-[1100px]:grid-cols-12" data-testid="review-summary">
        <motion.section {...RISE} transition={calm(STAGGER * 3)} className={`card flex flex-col gap-4 p-[clamp(18px,2vw,28px)] min-[1100px]:col-span-5 ${score.band ? `tone-${bandTone(score.band)}` : ''}`} aria-label="Score">
          <p className="text-[14px] font-semibold text-muted">{contractor?.name ?? 'Contractor not set'} · {draft.details.date ? dateLabel(draft.details.date) : 'no date'}</p>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="figure text-[clamp(64px,10svh,104px)]" data-testid="review-total">
              {score.total === null ? '—' : <CountUp value={score.total} format={fmtPct} duration={DUR} />}
              <span className="ml-0.5 text-[0.4em] tracking-normal text-muted">%</span>
            </p>
            {score.band && <span className="badge mb-3 px-2.5 py-[3px] text-[14px]" data-testid="review-band">{score.band}</span>}
          </div>
          <Bar value={score.total} color={score.band ? bandColor(score.band) : 'var(--control)'} className="h-[10px]" />
          <ul className="grid gap-2">
            {[...score.sections, ...score.cParts].map((s, k) => (
              <li key={s.code} className={`grid grid-cols-[2.4em_minmax(0,1fr)_minmax(60px,1fr)_3ch] items-center gap-2.5 text-[13px] ${k >= score.sections.length ? 'pl-4 text-faint' : ''}`}>
                <span className="font-semibold text-muted">{s.code}</span>
                <span className="truncate" title={s.label}>{(draft.type === 'hs' && SECTION_SHORT[s.code]) || s.label}</span>
                <Bar value={s.ratio} delay={0.1 + k * 0.06} />
                <span className="num text-right font-semibold">{pct(s.ratio)}</span>
              </li>
            ))}
          </ul>
          {draft.reportedScore !== null && (
            <div className={`mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-2xl px-4 py-3 text-[13px] ${differs ? 'tone-partial bg-[var(--tone-bg)]' : 'bg-fill-2'}`} data-testid="excel-vs-honest">
              <span><span className="text-muted">Excel says</span> <span className="num font-semibold">{pct(draft.reportedScore)}%</span></span>
              <span><span className="text-muted">Computed</span> <span className="num font-semibold">{pct(score.total)}%</span></span>
              {differs && <span className="basis-full text-[12px] text-[var(--tone)]">The template adds +0.012 and some cells were edited by hand; the app uses the answers.</span>}
            </div>
          )}
        </motion.section>

        <motion.section {...RISE} transition={calm(STAGGER * 4)} className="card flex flex-col gap-4 p-[clamp(18px,2vw,28px)] min-[1100px]:col-span-4" aria-label="Observations per category">
          <h3 className="text-[14px] font-semibold text-muted">Observations per category</h3>
          {perCat.length === 0 ? (
            <p className="text-[14px] text-faint">None</p>
          ) : (
            <ul className="grid gap-2.5" data-testid="category-bars">
              {perCat.map(({ c, n }, k) => {
                const Icon = CATEGORY_ICONS[c.icon];
                return (
                  <li key={c.id} className="grid grid-cols-[minmax(0,7.5em)_minmax(0,1fr)_2.5ch] items-center gap-2.5 text-[13px]">
                    <span className="flex min-w-0 items-center gap-1.5">
                      {Icon && <Icon size={13} strokeWidth={2.4} style={{ color: c.color }} className="shrink-0" aria-hidden />}
                      <span className="truncate">{c.short}</span>
                    </span>
                    <Bar value={n / maxCat} color="var(--bar)" delay={0.1 + k * 0.06} />
                    <span className="num text-right font-semibold">{n}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-[var(--hairline)] pt-4">
            {[['Findings', score.counts.findings], ['N/A', score.counts.na], ['Positives', counts.positive]].map(([k, v]) => (
              <div key={k as string}>
                <dt className="text-[12px] font-semibold text-muted">{k}</dt>
                <dd className="num mt-0.5 text-[20px] font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </motion.section>

        <motion.section {...RISE} transition={calm(STAGGER * 5)} className="card flex flex-col gap-4 p-[clamp(18px,2vw,28px)] min-[1100px]:col-span-3" aria-label="Finish">
          <AnimatePresence mode="wait" initial={false}>
            {submitted ? (
              <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: calm(0, 0.9) }} exit={{ opacity: 0, transition: QUICK }} className="flex flex-col gap-2" data-testid="submitted">
                <p className="text-[17px] font-semibold">Submitted</p>
              </motion.div>
            ) : (
              <motion.div key="todo" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: QUICK }} exit={{ opacity: 0, transition: QUICK }} className="flex flex-col gap-2">
                <p className="text-[17px] font-semibold">{missing.length ? 'Almost there' : 'Ready to submit'}</p>
                {missing.length > 0 && (
                  <ul className="flex flex-col gap-1 text-[13px]" data-testid="missing">
                    {missing.map((m) => (
                      <li key={m}>
                        <button type="button" onClick={() => onGo(m.includes('question') ? 2 : 1)} className="text-left text-[var(--accent)] hover:underline">{m}</button>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="mt-auto flex flex-col gap-2">
            {!submitted && (
              <Button kind="primary" onClick={onSubmit} disabled={missing.length > 0} testid="submit-audit" title={missing.join(' · ')}> Submit audit
              </Button>
            )}
            <Button kind="plain" onClick={onSave} testid="save-draft">{submitted ? 'Save changes' : 'Save draft'}</Button>
            <Button kind="ghost" onClick={onDownload} disabled={!draft.details.contractorId || !draft.details.date} testid="download-json"> Download JSON
            </Button>
            {submitted && <Button kind="ghost" onClick={onNew} testid="new-audit-again"><Plus size={15} strokeWidth={2.6} aria-hidden /> Another audit</Button>}
          </div>
        </motion.section>
      </div>
    </div>
  );
}


function NoteCard({ note, i, question, actions }: { note: DraftNote; i: number; question?: string; actions: WizardActions }) {
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: calm(Math.min(i, 8) * 0.05) }}
      exit={{ opacity: 0, scale: 0.97, transition: QUICK }}
      transition={QUICK}
      className="card flex min-w-0 flex-col gap-3 p-4"
      data-testid="note-card"
      data-kind={note.kind}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Kind" className="flex rounded-full bg-fill-2 p-[3px]">
          {KINDS.map((k) => (
            <button key={k.id} type="button" role="radio" aria-checked={note.kind === k.id}
              onClick={() => actions.updateNote(note.id, { kind: k.id })}
              disabled={k.id === 'finding' && !note.code}
              className={`h-7 rounded-full px-2.5 text-[12px] font-semibold transition-colors duration-300 disabled:hidden ${note.kind === k.id ? 'bg-surface text-ink shadow-[var(--shadow-card)]' : 'text-muted hover:text-ink'}`}>
              {k.label}
            </button>
          ))}
        </div>
        {note.code && <CodeChip code={note.code} />}
        <span className="ml-auto flex items-center gap-1">
          {note.kind !== 'positive' && note.category && (
            <CategorySelect value={note.category} auto={note.auto} label="Category" onChange={(c: CategoryId) => actions.updateNote(note.id, { category: c })} />
          )}
          <button type="button" onClick={() => actions.removeNote(note.id)} className="grid size-8 place-items-center rounded-full text-faint transition-colors hover:bg-fill-2 hover:text-ink" aria-label="Remove note" data-testid="remove-note">
            <Trash2 size={15} strokeWidth={2.2} aria-hidden />
          </button>
        </span>
      </div>
      {question && <p className="line-clamp-2 text-[13px] text-muted">{question}</p>}
      <textarea
        value={note.text}
        onChange={(e) => actions.updateNote(note.id, { text: e.target.value })}
        rows={3}
        autoFocus={!note.text}
        placeholder={note.kind === 'positive' ? 'What was done well' : 'What was observed'}
        aria-label="Note text"
        className="max-h-[260px] min-h-[72px] w-full resize-y rounded-xl bg-fill-2 px-3.5 py-2.5 text-[14px] leading-relaxed outline-none transition-shadow [field-sizing:content] placeholder:text-faint focus:shadow-[0_0_0_2px_var(--accent)]"
      />
    </motion.li>
  );
}
