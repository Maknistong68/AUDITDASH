export type Compliance = 'full' | 'partial' | 'no' | 'na';
export type CategoryId = 'leadership'|'documents'|'competence'|'subcontractor'|'monitoring'|'incident'|'site'|'health';
export type Subregion = 'SR1' | 'SR2';
/** "Q4-2025": the quarter of the audit date. The quarters present come from the data (data/seed/meta.json). */
export type Quarter = `Q${1 | 2 | 3 | 4}-${number}`;
export type Band = 'Excellent'|'Good'|'Partially Compliant'|'Minimally Compliant'|'Non-Compliant';
export interface Category { id: CategoryId; name: string; short: string; color: string; icon: string }
export interface ChecklistItem { code: string; section: 'A'|'B'|'C'; subsection: string | null; question: string; weight: number; category: CategoryId }
/** A checklist item of any audit type; `category` is a CategoryId for H&S, else a section slug like `security:A`. */
export interface TypedChecklistItem extends Omit<ChecklistItem, 'category' | 'section'> { section: string; category: string }
export type AuditType = 'hs' | 'security' | 'environmental' | 'welfare' | 'crc';
export type AppAnswer = 'compliant' | 'non_compliant' | 'observation' | 'na';
export interface TypeSection { code: string; title: string; category: string | null }
export interface Contractor { id: string; name: string; contractNo: string; subregion: Subregion }
export interface SectionScore { code: string; label: string; possible: number; scored: number }
export interface Audit { id: string; type?: AuditType; contractorId: string; quarter: Quarter; date: string; location: string; inspectionNo: string; auditors: string[];
  /** The workbook formula applied to the workbook's own points (A, B points ratio; C = mean of C1, C2; total = mean). */
  totalScore: number;
  /** TOTAL FINAL SCORE as typed in the Excel (may include manual edits); shown only as a data check. */
  reportedScore?: number | null;
  /** Where in the Excel the audit was read from. */
  source?: string;
  /** Data checks found while importing (score edited, points over possible, copied blocks). */
  issues?: string[];
  /** Part 1 answers per checklist code, when the completed checklist was imported (exact findings). */
  answers?: Record<string, Compliance>;
  sections: SectionScore[] }
export interface Observation { id: string; auditId: string; itemCode: string | null; kind: 'negative'|'positive'|'site'; text: string; category: CategoryId | null;
  /** Evidence-column marker on the SR# row: the auditor typed COMPLIANT or N/A there (not a finding). Absent = none. */
  marker?: 'compliant' | 'na' | null }
export interface Filter { quarter: Quarter | 'all'; regions: Subregion[]; contractorId?: string; type?: AuditType }  // contractorId not in URL; used by contractor profile
