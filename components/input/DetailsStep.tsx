'use client';
import { motion } from 'framer-motion';
import { AUDIT_TYPES } from '@/lib/auditTypeIds';
import type { AuditDraft } from '@/lib/input/model';
import type { LiveScore } from '@/lib/input/score';
import { calm, RISE, STAGGER } from '@/lib/motion';
import type { Contractor } from '@/lib/types';
import type { WizardActions } from './AuditWizard';
import { Field, INPUT } from './ui';

/** Step 2: who, when, where. Prefilled from the workbook header when uploaded. */
export function DetailsStep({ draft, contractors, actions, score }: { draft: AuditDraft; contractors: Contractor[]; actions: WizardActions; score: LiveScore }) {
  const d = draft.details;
  const typeLabel = AUDIT_TYPES.find((t) => t.id === draft.type)!.label;
  const unmatched = draft.source === 'excel' && !!d.project && !d.contractorId;
  const kinds = { finding: 0, site: 0, positive: 0 };
  for (const n of draft.notes) kinds[n.kind]++;
  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-[var(--gap-grid)]">
      <motion.header {...RISE} transition={calm()} className="flex flex-col gap-1 pt-2">
        <p className="text-[14px] font-semibold text-muted">{typeLabel}</p>
        <h1 className="text-[clamp(24px,3.6svh,32px)] font-semibold leading-[1.05] tracking-[-0.035em]">Audit details</h1>
      </motion.header>

      {draft.source === 'excel' && (
        <motion.section {...RISE} transition={calm(STAGGER)} className="card flex flex-col gap-4 p-5" data-testid="import-summary" aria-label="Read from the workbook">
          <p className="flex min-w-0 items-center gap-2 text-[14px] font-semibold">
            <span className="truncate">{draft.fileName}</span>
          </p>
          <dl className="grid grid-cols-2 gap-3 min-[600px]:grid-cols-4">
            {[
              ['Answers', `${score.counts.answered}/${score.counts.items}`],
              ['Item notes', kinds.finding],
              ['Site findings', kinds.site],
              ['Positives', kinds.positive],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-2xl bg-fill-2 px-3.5 py-3">
                <dt className="text-[12px] font-semibold text-muted">{k}</dt>
                <dd className="num figure mt-1 text-[26px]">{v}</dd>
              </div>
            ))}
          </dl>
          {draft.warnings.length > 0 && (
            <ul className="flex flex-col gap-1.5" data-testid="import-warnings">
              {draft.warnings.map((w) => (
                <li key={w} className="tone-partial flex items-start gap-2 rounded-xl bg-[var(--tone-bg)] px-3 py-2 text-[13px] text-[var(--tone)]"> {w}
                </li>
              ))}
            </ul>
          )}
        </motion.section>
      )}

      <motion.section {...RISE} transition={calm(STAGGER * 2)} className="card grid grid-cols-1 gap-5 p-[clamp(18px,2.2vw,32px)] min-[700px]:grid-cols-2" aria-label="Details">
        <Field
          label="Contractor"
          className="min-[700px]:col-span-2"
          hint={unmatched ? <span className="text-[var(--minimal)]">Workbook says “{d.project}”: pick the contractor.</span> : d.project ? <>Workbook: {d.project}</> : undefined}
        >
          <select
            data-testid="contractor-select"
            value={d.contractorId ?? ''}
            onChange={(e) => actions.setDetails({ contractorId: e.target.value || null })}
            className={`${INPUT} appearance-none`}
            style={unmatched ? { boxShadow: '0 0 0 2px var(--minimal-dot)' } : undefined}
          >
            <option value="">Choose a contractor…</option>
            {/* Active contractors of the register, grouped by where they were last audited (new ones last). */}
            {[...new Set(contractors.filter((c) => c.active).map((c) => c.subregion ?? 'New'))].sort().map((r) => (
              <optgroup key={r} label={r === 'New' ? 'Not audited yet' : `Sub Region ${r.slice(2)}`}>
                {contractors.filter((c) => c.active && (c.subregion ?? 'New') === r).map((c) => (
                  <option key={c.id} value={c.id}>{c.name} · {c.contractNo}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="Date">
          <input type="date" data-testid="date-input" value={d.date} onChange={(e) => actions.setDetails({ date: e.target.value })} className={INPUT} />
        </Field>
        <Field label="Inspection no.">
          <input value={d.inspectionNo} placeholder="HSW-01" onChange={(e) => actions.setDetails({ inspectionNo: e.target.value })} className={INPUT} />
        </Field>
        <Field label="Location" className="min-[700px]:col-span-2">
          <input value={d.location} placeholder="Project / site" onChange={(e) => actions.setDetails({ location: e.target.value })} className={INPUT} />
        </Field>
        <Field label="Auditors" className="min-[700px]:col-span-2" hint="Separate names with commas">
          <input
            data-testid="auditors-input"
            defaultValue={d.auditors.join(', ')}
            placeholder="Name, Name"
            onChange={(e) => actions.setDetails({ auditors: e.target.value.split(',').map((a) => a.replace(/\s+/g, ' ').trim()).filter(Boolean) })}
            className={INPUT}
          />
        </Field>
      </motion.section>
    </div>
  );
}
