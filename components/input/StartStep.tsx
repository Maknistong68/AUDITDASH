'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { AUDIT_TYPES } from '@/lib/auditTypeIds';
import { checklistFor, sectionsFor } from '@/lib/auditTypes';
import { bandTone, dateLabel, pct } from '@/lib/format';
import { emptyDraft, type AuditDraft } from '@/lib/input/model';
import { draftFromParsed, parseHsWorkbook } from '@/lib/input/parse';
import { liveScore } from '@/lib/input/score';
import { calm, QUICK, RISE, STAGGER } from '@/lib/motion';
import type { AuditType, ChecklistItem, Contractor } from '@/lib/types';
import { Button } from './ui';

/**
 * Step 1: pick the audit type, then upload the completed Excel checklist (H&S; read in this browser, photos never
 * read) or fill it in here. Below: audits saved in this browser, to resume or delete.
 */
export function StartStep({
  type, onType, onStart, saved, contractors, onResume, onDelete, current, onContinue,
}: {
  type: AuditType;
  onType: (t: AuditType) => void;
  onStart: (d: AuditDraft) => void;
  saved: AuditDraft[];
  contractors: Contractor[];
  onResume: (d: AuditDraft) => void;
  onDelete: (id: string) => void;
  current: AuditDraft | null;
  onContinue: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hs = type === 'hs';

  const read = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!/\.xlsx$/i.test(file.name)) { setError('Choose the .xlsx checklist workbook.'); return; }
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const parsed = parseHsWorkbook(bytes, checklistFor('hs') as unknown as ChecklistItem[]);
      if (!Object.keys(parsed.answers).length) throw new Error('No Full / Partial / No / N/A answers found in Part 1 of this sheet.');
      onStart(draftFromParsed(parsed, file.name, emptyDraft('hs')));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This workbook could not be read.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-[clamp(20px,3.4svh,40px)]">
      <motion.header {...RISE} transition={calm()} className="flex flex-col items-center gap-3 pt-[clamp(4px,2svh,24px)] text-center">
        <h1 className="text-[clamp(28px,4.4svh,44px)] font-semibold leading-[1.05] tracking-[-0.035em]">New audit</h1>
        <div role="radiogroup" aria-label="Audit type" className="flex max-w-full gap-0.5 overflow-x-auto rounded-full bg-fill-2 p-1" data-testid="type-picker">
          {AUDIT_TYPES.map((t) => {
            const on = t.id === type;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onType(t.id)}
                className={`relative h-8 shrink-0 rounded-full px-2.5 min-[600px]:px-3.5 text-[13px] font-semibold transition-colors duration-300 ${on ? 'text-ink' : 'text-muted hover:text-ink'}`}
              >
                {on && <motion.span layoutId="type-pill" transition={QUICK} className="absolute inset-0 rounded-full bg-surface shadow-[var(--shadow-card)]" />}
                <span className="relative">{t.short}</span>
              </button>
            );
          })}
        </div>
      </motion.header>

      {current && (
        <motion.div {...RISE} transition={calm(STAGGER)} className="card flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <p className="text-[15px]"><span className="font-semibold">An audit is open.</span> <span className="text-muted">Choosing again below replaces it.</span></p>
          <Button kind="primary" onClick={onContinue} testid="continue-open">Continue</Button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-[var(--gap-grid)] min-[860px]:grid-cols-2">
        <motion.div {...RISE} transition={calm(STAGGER * 2)}>
          <div
            role="button"
            tabIndex={hs ? 0 : -1}
            aria-disabled={!hs}
            data-testid="upload-card"
            onClick={() => hs && !busy && input.current?.click()}
            onKeyDown={(e) => { if (hs && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); input.current?.click(); } }}
            onDragOver={(e) => { if (!hs) return; e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); if (hs) void read(e.dataTransfer.files[0]); }}
            className={`card lift group relative flex h-full min-h-[clamp(220px,34svh,340px)] flex-col justify-between gap-6 overflow-hidden p-[clamp(20px,2.4vw,36px)] outline-none ${hs ? 'cursor-pointer' : 'opacity-55'}`}
            style={over ? { boxShadow: 'inset 0 0 0 2px var(--accent), var(--shadow-lift)' } : undefined}
          >
            <span aria-hidden className="pointer-events-none absolute inset-3 rounded-[16px] border-2 border-dashed transition-colors duration-500" style={{ borderColor: over ? 'var(--accent)' : 'var(--hairline)' }} />
            <span className="relative grid size-14 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]">
              {busy ? <Loader2 size={26} className="motion-safe:animate-spin" aria-hidden /> : <span className="text-[22px] font-semibold leading-none">xlsx</span>}
            </span>
            <div className="relative flex flex-col gap-2">
              <h2 className="text-[clamp(21px,2.6svh,26px)] font-semibold tracking-[-0.025em]">Upload the Excel checklist</h2>
              <p className="text-[15px] text-muted">
                {hs ? <>Drop the completed <span className="font-semibold text-ink">.xlsx</span> here or click to choose.</> : 'Excel import is for Health & Safety checklists.'}
              </p>
            </div>
            <input
              ref={input}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              tabIndex={-1}
              data-testid="xlsx-input"
              disabled={!hs}
              onChange={(e) => void read(e.target.files?.[0])}
            />
          </div>
        </motion.div>

        <motion.div {...RISE} transition={calm(STAGGER * 3)}>
          <button
            type="button"
            data-testid="manual-card"
            onClick={() => onStart({ ...emptyDraft(type), source: 'manual' })}
            className="card lift group flex h-full min-h-[clamp(220px,34svh,340px)] w-full flex-col justify-between gap-6 p-[clamp(20px,2.4vw,36px)] text-left"
          >
            <span className="grid size-14 place-items-center rounded-2xl bg-fill-2 text-ink">
            </span>
            <div className="flex flex-col gap-2">
              <h2 className="text-[clamp(21px,2.6svh,26px)] font-semibold tracking-[-0.025em]">Fill in the checklist here</h2>
              <p className="text-[15px] text-muted">
                {checklistFor(type).length} questions · {AUDIT_TYPES.find((t) => t.id === type)!.label}
              </p>
              <span className="inline-flex items-center gap-1 text-[14px] font-semibold text-[var(--accent)]">
                Start
              </span>
            </div>
          </button>
        </motion.div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            role="alert"
            data-testid="upload-error"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0, transition: QUICK }}
            exit={{ opacity: 0, transition: QUICK }}
            className="tone-non badge mx-auto max-w-full whitespace-normal px-4 py-2 text-[14px]"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <SavedList saved={saved} contractors={contractors} onResume={onResume} onDelete={onDelete} />
    </div>
  );
}

function SavedList({ saved, contractors, onResume, onDelete }: {
  saved: AuditDraft[]; contractors: Contractor[]; onResume: (d: AuditDraft) => void; onDelete: (id: string) => void;
}) {
  const [confirm, setConfirm] = useState<string | null>(null);
  if (!saved.length) return null;
  const name = (id: string | null) => contractors.find((c) => c.id === id)?.name ?? 'Contractor not set';
  return (
    <motion.section {...RISE} transition={calm(STAGGER * 5)} aria-labelledby="saved-h" data-testid="saved-list" className="flex flex-col gap-3">
      <h2 id="saved-h" className="text-[15px] font-semibold text-muted">Saved</h2>
      <ul className="grid grid-cols-1 gap-[var(--gap-grid)] min-[760px]:grid-cols-2 min-[1200px]:grid-cols-3">
        <AnimatePresence initial={false}>
          {saved.map((d) => {
            const s = liveScore(d.type, checklistFor(d.type), sectionsFor(d.type), d.answers);
            return (
              <motion.li
                key={d.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: calm(0, 0.8) }}
                exit={{ opacity: 0, scale: 0.97, transition: QUICK }}
                transition={QUICK}
                className="card flex items-center gap-4 p-4"
                data-testid="saved-item"
              >
                <span className={`num grid size-12 shrink-0 place-items-center rounded-full text-[15px] font-semibold ${s.band ? `tone-${bandTone(s.band)}` : ''}`} style={{ background: s.band ? 'var(--tone-bg)' : 'var(--fill-2)', color: s.band ? 'var(--tone)' : 'var(--muted)' }}>
                  {pct(s.total)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{name(d.details.contractorId)}</p>
                  <p className="truncate text-[13px] text-muted">
                    {AUDIT_TYPES.find((t) => t.id === d.type)!.short} · {d.details.date ? dateLabel(d.details.date) : 'No date'} · {d.status === 'submitted' ? 'Submitted' : 'Draft'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => onResume(d)} className="grid size-9 place-items-center rounded-full bg-fill-2 text-ink transition-colors hover:bg-fill" aria-label="Resume" title="Resume" data-testid="saved-resume">
                    <RotateCcw size={16} strokeWidth={2.2} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => (confirm === d.id ? (onDelete(d.id), setConfirm(null)) : setConfirm(d.id))}
                    onBlur={() => setConfirm(null)}
                    className={`grid h-9 place-items-center rounded-full transition-[background-color,width,color] duration-300 ${confirm === d.id ? 'tone-non w-[76px] bg-[var(--tone-bg)] text-[13px] font-semibold text-[var(--tone)]' : 'w-9 text-muted hover:bg-fill-2 hover:text-ink'}`}
                    aria-label={confirm === d.id ? 'Confirm delete' : 'Delete'}
                    title="Delete"
                  >
                    {confirm === d.id ? 'Delete' : <Trash2 size={16} strokeWidth={2.2} aria-hidden />}
                  </button>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </motion.section>
  );
}
