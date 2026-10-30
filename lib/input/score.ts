import { scoreAppAudit } from '@/lib/appScoring';
import { bandFor, scoreResponses } from '@/lib/scoring';
import type { AppAnswer, Audit, AuditType, Band, ChecklistItem, Compliance, Observation, SectionScore, TypeSection, TypedChecklistItem } from '@/lib/types';
import type { AuditDraft } from './model';
import { subregionFor } from './contractors';

const VALUE: Record<Exclude<Compliance, 'na'>, number> = { full: 1, partial: 0.5, no: 0 };

export const SECTION_LABELS: Record<string, string> = { A: 'MANAGEMENT', B: 'PROCESS AND PROCEDURES (ASSESSED ON SITE)', C: 'PLANNING AND COMMITMENT' };
/** Part 2 row names (scripts/import_excel.py SUB_LABELS). */
export const SUB_LABELS: Record<string, string> = {
  B1: 'Risk Assessments Method Statements', B2: 'Competent Person Designation', B3: 'Emergency Response',
  B4: 'Work Permit', B5: 'Utility Clearance', B6: 'Subcontractor Management', B7: 'Training',
  B8: 'Incident reporting', B9: 'Fire Prevention', B10: 'Personal Protective Equipment', B11: 'Medical',
  B12: 'Occupational and Health Surveillance', C1: 'Leadership Engagement', C2: 'Planning',
};
const HS_ORDER = ['A', 'B', ...Array.from({ length: 12 }, (_, i) => `B${i + 1}`), 'C', 'C1', 'C2'];

/**
 * Part 2 rebuilt from Part 1 (import_excel.sections_from_answers): A, B, B1..B12, C, C1, C2 as {code, label, possible,
 * scored}. Full = weight, Partial = weight / 2, No = 0; N/A and unanswered items count in neither.
 */
export function sectionsFromAnswers(items: ChecklistItem[], answers: Record<string, Compliance>): SectionScore[] {
  const acc = new Map<string, { p: number; s: number }>();
  for (const item of items) {
    const a = answers[item.code];
    if (a === undefined || a === 'na') continue;
    for (const code of new Set([item.section, item.subsection ?? item.section])) {
      const x = acc.get(code) ?? { p: 0, s: 0 };
      x.p += item.weight;
      x.s += item.weight * VALUE[a];
      acc.set(code, x);
    }
  }
  return HS_ORDER.map((code) => ({
    code,
    label: SECTION_LABELS[code] ?? SUB_LABELS[code],
    possible: acc.get(code)?.p ?? 0,
    scored: acc.get(code)?.s ?? 0,
  }));
}

export interface LiveSection { code: string; label: string; ratio: number | null; possible: number; scored: number }
export interface LiveScore {
  total: number | null;
  band: Band | null;
  /** H&S: A, B, C (C = mean of C1, C2, as in the total). Other types: their sections. */
  sections: LiveSection[];
  /** H&S only: C1 and C2 (the two halves of C). */
  cParts: LiveSection[];
  counts: { items: number; answered: number; full: number; partial: number; no: number; na: number; unanswered: number; findings: number };
}

const TO_APP: Record<Compliance, AppAnswer> = { full: 'compliant', partial: 'observation', no: 'non_compliant', na: 'na' };

function counts(items: { code: string }[], answers: Record<string, Compliance>): LiveScore['counts'] {
  const c = { items: items.length, answered: 0, full: 0, partial: 0, no: 0, na: 0, unanswered: 0, findings: 0 };
  for (const i of items) {
    const a = answers[i.code];
    if (!a) { c.unanswered++; continue; }
    c.answered++;
    c[a]++;
  }
  c.findings = c.partial + c.no;
  return c;
}

/**
 * The live score of an audit being entered. H&S: the workbook formula exactly (lib/scoring scoreResponses: A and B
 * Σw·v/Σw, C = mean(C1, C2), total = mean of the applicable sections; nothing added). Other types: lib/appScoring
 * (mean of section ratios), Full/Partial/No mapped to Compliant/Observation/Non-Compliant.
 */
export function liveScore(type: AuditType, items: TypedChecklistItem[], sections: TypeSection[], answers: Record<string, Compliance>): LiveScore {
  const pts = (list: TypedChecklistItem[]) => {
    let p = 0, s = 0;
    for (const i of list) {
      const a = answers[i.code];
      if (a && a !== 'na') { p += i.weight; s += i.weight * VALUE[a]; }
    }
    return { possible: p, scored: s };
  };
  if (type === 'hs') {
    const hs = items as unknown as ChecklistItem[];
    const total = scoreResponses(hs, answers).score;
    const secs = sections.map((d) => {
      const list = items.filter((i) => i.section === d.code);
      return { code: d.code, label: d.title, ratio: scoreResponses(list as unknown as ChecklistItem[], answers).score, ...pts(list) };
    });
    const cParts = ['C1', 'C2'].map((code) => {
      const list = items.filter((i) => i.section === 'C' && (i.subsection ?? i.code.split('.')[0]) === code);
      const p = pts(list);
      return { code, label: SUB_LABELS[code], ratio: p.possible > 0 ? p.scored / p.possible : null, ...p };
    });
    return { total, band: total === null ? null : bandFor(total), sections: secs, cParts, counts: counts(items, answers) };
  }
  const app: Record<string, AppAnswer> = {};
  for (const [k, v] of Object.entries(answers)) app[k] = TO_APP[v];
  const s = scoreAppAudit(type, items, app);
  return {
    total: s.score,
    band: s.score === null ? null : bandFor(s.score),
    sections: s.sections.map((x) => ({ code: x.code, label: x.title, ratio: x.score, ...pts(items.filter((i) => i.section === x.code)) })),
    cParts: [],
    counts: counts(items, answers),
  };
}

/** "2026-07-19" -> "Q3-2026". */
export const quarterOf = (iso: string) => `Q${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1}-${iso.slice(0, 4)}` as Audit['quarter'];

/** Why a draft cannot be exported / submitted yet (empty = ready). */
export function missingForSubmit(d: AuditDraft, items: { code: string }[]): string[] {
  const out: string[] = [];
  if (!d.details.contractorId) out.push('Pick the contractor');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.details.date)) out.push('Set the audit date');
  const open = items.filter((i) => !d.answers[i.code]).length;
  if (open) out.push(`${open} question${open === 1 ? '' : 's'} unanswered`);
  return out;
}

const KIND: Record<AuditDraft['notes'][number]['kind'], Observation['kind']> = { finding: 'negative', site: 'site', positive: 'positive' };

/**
 * The draft as rows for data/seed/audits.json and observations.json (the import script's shape), so it can be added
 * to the master data. Requires contractor and date.
 */
export function toSeedRows(d: AuditDraft, items: TypedChecklistItem[], sections: TypeSection[]): { audits: Audit[]; observations: Observation[] } {
  const contractorId = d.details.contractorId ?? 'unknown';
  const date = d.details.date || new Date().toISOString().slice(0, 10);
  const id = `${contractorId}-${quarterOf(date)}-${date.replace(/-/g, '')}`;
  const live = liveScore(d.type, items, sections, d.answers);
  const total = live.total === null ? 0 : Math.round(live.total * 10000) / 10000;
  const issues: string[] = [];
  if (d.reportedScore !== null && live.total !== null && Math.round(d.reportedScore * 100) !== Math.round(live.total * 100)) {
    issues.push(`Excel total ${Math.round(d.reportedScore * 100)}% differs from ${Math.round(live.total * 100)}% computed from its own points`);
  }
  const secRows: SectionScore[] = d.type === 'hs'
    ? sectionsFromAnswers(items as unknown as ChecklistItem[], d.answers)
    : live.sections.map((s) => ({ code: s.code, label: s.label, possible: s.possible, scored: s.scored }));
  const audit: Audit = {
    id,
    ...(d.type === 'hs' ? {} : { type: d.type }),
    contractorId,
    subregion: subregionFor(d.details.location, d.details.contractorId) ?? 'SR1',
    quarter: quarterOf(date),
    date,
    location: d.details.location,
    inspectionNo: d.details.inspectionNo,
    auditors: d.details.auditors,
    totalScore: total,
    reportedScore: d.reportedScore,
    source: d.fileName ? `${d.fileName} › Health & Safety` : 'Entered in the audit app',
    issues,
    answers: { ...d.answers },
    sections: secRows,
  };
  const observations: Observation[] = d.notes
    .filter((n) => n.text.trim())
    .map((n, i) => ({
      id: `${id}-${i + 1}`,
      auditId: id,
      itemCode: n.code,
      kind: KIND[n.kind],
      text: n.text.trim(),
      category: n.kind === 'positive' ? null : n.category,
      marker: null,
    }));
  return { audits: [audit], observations };
}
