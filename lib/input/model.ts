import type { AuditType, CategoryId, Compliance } from '@/lib/types';
import type { NoteKind } from './categorise';

/** One Part 3 note (or a note the auditor added): a finding on a checklist item, a site finding, or a positive. */
export interface DraftNote {
  id: string;
  /** Checklist item code for a finding; null for site findings and positives. */
  code: string | null;
  kind: NoteKind;
  text: string;
  /** The category shown (auto unless the auditor picked another); null for positives. */
  category: CategoryId | null;
  /** The automatic category, kept so the UI can say "changed" and reset it. */
  auto: CategoryId | null;
}

export interface AuditDetails {
  contractorId: string | null;
  /** The workbook's raw `Project:` string, when uploaded (shown when it did not match a contractor). */
  project: string;
  /** ISO date "YYYY-MM-DD" ('' until set). */
  date: string;
  location: string;
  inspectionNo: string;
  auditors: string[];
}

/** An audit being entered: everything the wizard edits, saved as-is in this browser. */
export interface AuditDraft {
  id: string;
  status: 'draft' | 'submitted';
  type: AuditType;
  source: 'excel' | 'manual';
  /** Workbook file name, when uploaded. */
  fileName: string | null;
  /** ISO timestamp of the last save. */
  savedAt: string;
  details: AuditDetails;
  answers: Record<string, Compliance>;
  notes: DraftNote[];
  /** TOTAL FINAL SCORE as cached in the uploaded workbook (never used for scoring). */
  reportedScore: number | null;
  /** Things the parser noticed (unknown project, weight differences ...). */
  warnings: string[];
}

let seq = 0;
/** A short unique id (time + counter + random); not cryptographic. */
export function uid(prefix = 'n'): string {
  seq = (seq + 1) % 1e6;
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function emptyDraft(type: AuditType): AuditDraft {
  return {
    id: uid('audit'),
    status: 'draft',
    type,
    source: 'manual',
    fileName: null,
    savedAt: new Date().toISOString(),
    details: { contractorId: null, project: '', date: '', location: '', inspectionNo: '', auditors: [] },
    answers: {},
    notes: [],
    reportedScore: null,
    warnings: [],
  };
}
