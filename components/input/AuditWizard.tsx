'use client';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import contractorsSeed from '@/data/seed/contractors.json';
import { checklistFor, sectionsFor } from '@/lib/auditTypes';
import { autoCategoryFor, type NoteKind } from '@/lib/input/categorise';
import { emptyDraft, uid, type AuditDraft, type AuditDetails, type DraftNote } from '@/lib/input/model';
import { liveScore, toSeedRows } from '@/lib/input/score';
import { deleteSaved, loadSaved, saveDraft } from '@/lib/input/storage';
import { calm, QUICK } from '@/lib/motion';
import type { AuditType, Compliance, Contractor } from '@/lib/types';
import { ChecklistStep } from './ChecklistStep';
import { DetailsStep } from './DetailsStep';
import { ReviewStep } from './ReviewStep';
import { StartStep } from './StartStep';
import { Stepper, STEPS } from './Stepper';
import { Button } from './ui';
import { submitAudit } from '@/app/audits/new/actions';

const CONTRACTORS = contractorsSeed as Contractor[];

export interface WizardActions {
  setDetails: (patch: Partial<AuditDetails>) => void;
  setAnswer: (code: string, v: Compliance | undefined) => void;
  /** The finding note of a question (created / removed as its text fills / empties). */
  setItemNote: (code: string, text: string) => void;
  updateNote: (id: string, patch: Partial<Pick<DraftNote, 'text' | 'kind' | 'category'>>) => void;
  addNote: (kind: NoteKind) => void;
  removeNote: (id: string) => void;
}

/** Download a JSON file (no server involved). */
function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * The audit input wizard: Start (upload the Excel checklist or fill in here) → Details → Checklist → Observations &
 * review. All state is one AuditDraft; scores are recomputed from it on every change. Drafts and submitted audits are
 * kept in this browser only; Download gives the audits.json / observations.json rows for the master data.
 */
export function AuditWizard({ initialType, online = false }: { initialType: AuditType; online?: boolean }) {
  const reduce = useReducedMotion();
  const [draft, setDraft] = useState<AuditDraft>(() => emptyDraft(initialType));
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [started, setStarted] = useState(false);
  const [saved, setSaved] = useState<AuditDraft[]>([]);
  const [dirty, setDirty] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => { setSaved(loadSaved()); }, []);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 3200);
    return () => clearTimeout(t);
  }, [flash]);

  const items = useMemo(() => checklistFor(draft.type), [draft.type]);
  const sections = useMemo(() => sectionsFor(draft.type), [draft.type]);
  const score = useMemo(() => liveScore(draft.type, items, sections, draft.answers), [draft.type, items, sections, draft.answers]);

  const go = useCallback((n: number) => {
    setDir(n >= step ? 1 : -1);
    setStep(Math.max(0, Math.min(STEPS.length - 1, n)));
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }, [step, reduce]);

  const edit = useCallback((fn: (d: AuditDraft) => AuditDraft) => {
    setDraft((d) => fn(d));
    setDirty(true);
  }, []);

  const actions: WizardActions = useMemo(() => ({
    setDetails: (patch) => edit((d) => ({ ...d, details: { ...d.details, ...patch } })),
    setAnswer: (code, v) => edit((d) => {
      const answers = { ...d.answers };
      if (v) answers[code] = v; else delete answers[code];
      return { ...d, answers };
    }),
    setItemNote: (code, text) => edit((d) => {
      const i = d.notes.findIndex((n) => n.code === code && n.kind === 'finding');
      if (i < 0) {
        if (!text.trim()) return d;
        const auto = autoCategoryFor(d.type, code, 'finding', text);
        return { ...d, notes: [...d.notes, { id: uid('n'), code, kind: 'finding', text, category: auto, auto }] };
      }
      if (!text.trim()) return { ...d, notes: d.notes.filter((_, j) => j !== i) };
      return { ...d, notes: d.notes.map((n, j) => (j === i ? { ...n, text } : n)) };
    }),
    updateNote: (id, patch) => edit((d) => ({
      ...d,
      notes: d.notes.map((n) => {
        if (n.id !== id) return n;
        const next = { ...n, ...patch };
        if (patch.kind && patch.kind !== n.kind) {
          const auto = autoCategoryFor(d.type, next.kind === 'finding' ? next.code : null, next.kind, next.text);
          next.auto = auto;
          next.category = next.kind === 'positive' ? null : n.category ?? auto;
          if (next.kind !== 'finding') next.code = null;
        }
        if (patch.text !== undefined && n.kind !== 'positive' && n.category === n.auto) {
          // still automatic: keep following the words (site findings)
          const auto = autoCategoryFor(d.type, n.code, n.kind, patch.text);
          next.auto = auto;
          next.category = auto;
        }
        return next;
      }),
    })),
    addNote: (kind) => edit((d) => {
      const auto = autoCategoryFor(d.type, null, kind, '');
      return { ...d, notes: [...d.notes, { id: uid('n'), code: null, kind, text: '', category: auto, auto }] };
    }),
    removeNote: (id) => edit((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) })),
  }), [edit]);

  const begin = (d: AuditDraft) => {
    setDraft(d);
    setStarted(true);
    setDirty(d.source === 'excel');
    setDir(1);
    setStep(1);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  };

  const persist = (status: AuditDraft['status']) => {
    const next = saveDraft({ ...draft, status });
    if (next) {
      setDraft(next);
      setSaved(loadSaved());
      setDirty(false);
      setFlash(status === 'submitted' ? 'Audit submitted · saved in this browser' : 'Draft saved in this browser');
    } else {
      setFlash('This browser blocked saving: use Download to keep the audit');
    }
    return next;
  };

  /** Online: the audit goes to the server for a lead to review (and stays saved here); otherwise saved here only. */
  const submit = async () => {
    if (!online) { persist('submitted'); return; }
    const res = await submitAudit({ ...draft, status: 'submitted' });
    if (res.ok) {
      persist('submitted');
      setFlash('Audit filed for review');
    } else {
      setFlash(res.error);
    }
  };

  const exportJson = () => {
    const rows = toSeedRows(draft, items, sections);
    download(`${rows.audits[0].id}.json`, rows);
  };

  const reset = () => {
    setDraft(emptyDraft(draft.type));
    setStarted(false);
    setDirty(false);
    go(0);
  };

  const contractor = CONTRACTORS.find((c) => c.id === draft.details.contractorId) ?? null;
  const last = step === STEPS.length - 1;

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-[clamp(16px,2.6svh,28px)] px-[var(--gutter)] pb-28">
      <Stepper step={step} enabled={started} onGo={go} />

      <div className="relative">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 36 * dir, filter: 'blur(6px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)', transition: calm(0, 1.1) }}
            exit={reduce ? { opacity: 0, transition: QUICK } : { opacity: 0, x: -24 * dir, filter: 'blur(4px)', transition: QUICK }}
          >
            {step === 0 && (
              <StartStep
                type={draft.type}
                onType={(t) => setDraft(emptyDraft(t))}
                onStart={begin}
                saved={saved}
                contractors={CONTRACTORS}
                onResume={(d) => { begin(d); setDirty(false); }}
                onDelete={(id) => { deleteSaved(id); setSaved(loadSaved()); }}
                current={started ? draft : null}
                onContinue={() => go(1)}
              />
            )}
            {step === 1 && <DetailsStep draft={draft} contractors={CONTRACTORS} actions={actions} score={score} />}
            {step === 2 && <ChecklistStep draft={draft} items={items} sections={sections} actions={actions} score={score} />}
            {step === 3 && (
              <ReviewStep
                draft={draft}
                items={items}
                score={score}
                contractor={contractor}
                actions={actions}
                onSave={() => persist('draft')}
                onSubmit={() => void submit()}
                onDownload={exportJson}
                onNew={reset}
                onGo={go}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {started && (
        <nav aria-label="Wizard" className="glass-bar fixed inset-x-0 bottom-0 z-20 border-t border-[var(--hairline)] print:hidden">
          <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-3 px-[var(--gutter)] py-3">
            <Button kind="ghost" onClick={() => go(step - 1)} disabled={step === 0} testid="wizard-back">
              <ArrowLeft size={16} strokeWidth={2.4} aria-hidden /> Back
            </Button>
            <AnimatePresence>
              {flash && (
                <motion.p
                  role="status"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0, transition: QUICK }}
                  exit={{ opacity: 0, transition: QUICK }}
                  className="min-w-0 truncate text-center text-[13px] font-semibold text-muted"
                  data-testid="wizard-flash"
                >
                  {flash}
                </motion.p>
              )}
            </AnimatePresence>
            {!flash && (
              <p className="hidden min-w-0 truncate text-[13px] text-faint min-[600px]:block">
                {dirty ? 'Unsaved changes' : draft.status === 'submitted' ? 'Submitted' : 'Saved'}
              </p>
            )}
            {last ? (
              <Button kind="plain" onClick={() => persist('draft')} testid="wizard-save">Save draft</Button>
            ) : (
              <Button kind="primary" onClick={() => go(step + 1)} testid="wizard-next">
                {STEPS[step + 1].short}
              </Button>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}

