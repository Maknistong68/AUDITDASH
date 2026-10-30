import type { ChecklistItem, Compliance } from '@/lib/types';
import { autoCategory, type NoteKind } from './categorise';
import { contractorForProject } from './contractors';
import type { AuditDraft, DraftNote } from './model';
import { uid } from './model';
import { cell, excelSerialToIso, readWorkbook, type CellValue, type Sheet, type Workbook } from './xlsx';

export const HS_SHEET = 'Health & Safety';

const ITEM_CODE = /^[ABC]\d+(\.\d+)?$/;

/** "Full" / "Partial" / "No" / "NO" / "N/A" (any case, stray spaces) -> Compliance; anything else -> null. */
export function toCompliance(v: CellValue): Compliance | null {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, '').toLowerCase();
  if (t === 'full') return 'full';
  if (t === 'partial') return 'partial';
  if (t === 'no') return 'no';
  if (t === 'n/a' || t === 'na') return 'na';
  return null;
}

/** Item code -> its subsection: "B11.2" -> "B11", "C1.3" -> "C1", "A4" -> null (the template mislabels some sub-headers). */
export function subsectionOf(code: string): string | null {
  const m = /^([BC]\d+)\.\d+$/.exec(code);
  return m ? m[1] : null;
}

/** Part 3 label -> note kind (import_excel._classify_kind). */
export function labelKind(label: string): 'positive' | 'site' | null {
  const low = label.toLowerCase().split(/\s+/).filter(Boolean).join(' ');
  if (/^positive( observations?)?$/.test(low)) return 'positive';
  if (/^(other\s*\/\s*site|site\s*\/\s*other)( observations?| findings?)?$/.test(low)) return 'site';
  return null;
}

/** Notes that only say the item did not apply ("Not Applicable…", "N/A", "NA - …") are not observations (import_excel.is_na_note). */
export function isNaNote(text: string): boolean {
  const t = text.replace(/^[\s•·*\-–—]+/, '');
  return /^(not\s+applicable|n\/a|na[ -])/i.test(t) || ['n/a', 'na', 'not applicable'].includes(t.trim().toLowerCase());
}

const str = (v: CellValue): string => (v === null ? '' : typeof v === 'string' ? v : String(v));
const clean = (v: CellValue): string => str(v).replace(/\s+/g, ' ').trim();

/** Value right of a header label (" Project:", " Date:" …) in the first rows: the next non-empty cell in that row. */
function labelValue(s: Sheet, label: string, rows = 6): CellValue {
  const cols = 'ABCDEFGHIJKLMNO';
  for (let r = 1; r <= rows; r++) {
    for (let i = 0; i < cols.length; i++) {
      const v = cell(s, cols[i], r);
      if (typeof v === 'string' && v.trim() === label) {
        for (let j = i + 1; j < cols.length; j++) {
          const x = cell(s, cols[j], r);
          if (x !== null && str(x).trim() !== '') return x;
        }
        return null;
      }
    }
  }
  return null;
}

/** A header date: Excel serial number, ISO text, or dd/mm/yyyy text -> "YYYY-MM-DD" ('' when unreadable). */
export function toIsoDate(v: CellValue): string {
  if (typeof v === 'number' && v > 0) return excelSerialToIso(v);
  const t = str(v).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}

export interface ParsedChecklist {
  sheet: string;
  project: string;
  contractorId: string | null;
  date: string;
  location: string;
  inspectionNo: string;
  auditors: string[];
  /** Part 1 answers by item code (the first answer wins when a code repeats). */
  answers: Record<string, Compliance>;
  /** Part 3, categorised. Photos / evidence are never read. */
  notes: DraftNote[];
  /** TOTAL FINAL SCORE cached in Part 2 (never used for scoring). */
  reportedScore: number | null;
  warnings: string[];
}

/**
 * Read a completed H&S checklist sheet: header (rows 2–4), Part 1 answers (col B code, col I weight, col J compliance),
 * Part 2's cached TOTAL FINAL SCORE, and Part 3 notes from the "SR#" row down (col B code, col C label or question,
 * col G comment; col H evidence/photos is ignored). Continuation rows (no code, no label, text in G) append to the
 * previous note. Notes on an item are categorised by its code, site findings by keywords, positives get none.
 */
export function parseHsSheet(s: Sheet, items: ChecklistItem[]): ParsedChecklist {
  const warnings: string[] = [];
  const known = new Map(items.map((i) => [i.code, i]));
  const project = clean(labelValue(s, 'Project:'));
  const contractorId = contractorForProject(project);
  if (project && !contractorId) warnings.push(`Project “${project}” is not in the contractor list: pick the contractor.`);

  const answers: Record<string, Compliance> = {};
  let reportedScore: number | null = null;
  let srRow = 0;
  const weightDiffs: string[] = [];
  for (let r = 1; r <= s.maxRow; r++) {
    const b = str(cell(s, 'B', r)).replace(/\s+/g, '');
    if (b === 'SR#') { srRow = r; break; }
    if (b.toUpperCase() === 'TOTALFINALSCORE') {
      const v = cell(s, 'H', r);
      reportedScore = typeof v === 'number' ? v : null;
      continue;
    }
    const c = toCompliance(cell(s, 'J', r));
    if (!ITEM_CODE.test(b) || !c) continue;
    if (!known.has(b)) { warnings.push(`${b} is not in the checklist: its answer was left out.`); continue; }
    if (b in answers) continue;
    answers[b] = c;
    const w = cell(s, 'I', r);
    if (typeof w === 'number' && w !== known.get(b)!.weight) weightDiffs.push(`${b} (${w} in Excel, ${known.get(b)!.weight} in the checklist)`);
  }
  if (weightDiffs.length) warnings.push(`Weights differ from the checklist for ${weightDiffs.join(', ')}; the checklist weights are used.`);

  const notes: DraftNote[] = [];
  if (srRow) {
    let last: { code: string | null; kind: NoteKind; parts: string[] } | null = null;
    const entries: { code: string | null; kind: NoteKind; parts: string[] }[] = [];
    for (let r = srRow + 1; r <= s.maxRow; r++) {
      const sr = str(cell(s, 'B', r)).replace(/\s+/g, '');
      const code = /^([ABC]\d+(?:\.\d+)?)/.exec(sr)?.[1] ?? null;
      let kind: NoteKind | null = null;
      for (const col of ['C', 'D', 'E', 'F']) {
        const k = labelKind(str(cell(s, col, r)));
        if (k) kind = k;
      }
      if (code && !kind) kind = 'finding';
      const raw = cell(s, 'G', r);
      const text = typeof raw === 'string' && raw.trim() ? raw.replace(/\r\n?/g, '\n').replace(/\s+$/, '') : '';
      if (kind) {
        last = { code, kind, parts: text ? [text] : [] };
        entries.push(last);
      } else if (last && text) {
        last.parts.push(text);
      }
    }
    for (const e of entries) {
      const text = e.parts.join('\n');
      if (!text.trim() || isNaNote(text)) continue;
      const auto = autoCategory(e.code, e.kind, text);
      notes.push({ id: uid('n'), code: e.code, kind: e.kind, text, category: auto, auto });
    }
  } else {
    warnings.push('No “Summary of Findings” (SR#) table found: no notes were imported.');
  }

  return {
    sheet: s.name,
    project,
    contractorId,
    date: toIsoDate(labelValue(s, 'Date:')),
    location: clean(labelValue(s, 'Location:')),
    inspectionNo: clean(labelValue(s, 'Inspection No.:')),
    auditors: str(labelValue(s, 'Auditor:')).split(',').map((a) => a.replace(/\s+/g, ' ').trim()).filter(Boolean),
    answers,
    notes,
    reportedScore,
    warnings,
  };
}

/** Open the workbook bytes and read its "Health & Safety" sheet. Throws a readable Error when it cannot. */
export function parseHsWorkbook(bytes: Uint8Array, items: ChecklistItem[]): ParsedChecklist {
  const wb: Workbook = readWorkbook(bytes);
  const s = wb.sheet(HS_SHEET);
  if (!s) throw new Error(`No “${HS_SHEET}” sheet in this workbook (found: ${wb.sheetNames.join(', ') || 'none'}).`);
  return parseHsSheet(s, items);
}

/** A parsed workbook as a fresh draft (H&S, source excel). */
export function draftFromParsed(p: ParsedChecklist, fileName: string, base: AuditDraft): AuditDraft {
  return {
    ...base,
    type: 'hs',
    source: 'excel',
    fileName,
    details: {
      contractorId: p.contractorId,
      project: p.project,
      date: p.date,
      location: p.location,
      inspectionNo: p.inspectionNo,
      auditors: p.auditors,
    },
    answers: p.answers,
    notes: p.notes,
    reportedScore: p.reportedScore,
    warnings: p.warnings,
  };
}
