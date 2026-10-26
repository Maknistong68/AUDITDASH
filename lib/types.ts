export type Compliance = 'full' | 'partial' | 'no' | 'na';
export type CategoryId = 'leadership'|'plans'|'rams'|'permits'|'competence'|'subcontractor'|'monitoring'|'incident'|'site'|'health';
export type Subregion = 'SR1' | 'SR2';
export type Quarter = 'Q4-2025' | 'Q1-2026';
export type Band = 'Excellent'|'Good'|'Partially Compliant'|'Minimally Compliant'|'Non-Compliant';
export interface Category { id: CategoryId; name: string; short: string; color: string; icon: string }
export interface ChecklistItem { code: string; section: 'A'|'B'|'C'; subsection: string | null; question: string; weight: number; category: CategoryId }
export interface Contractor { id: string; name: string; contractNo: string; subregion: Subregion }
export interface SectionScore { code: string; label: string; possible: number; scored: number }
export interface Audit { id: string; contractorId: string; quarter: Quarter; date: string; location: string; inspectionNo: string; auditors: string[]; totalScore: number; sections: SectionScore[] }
export interface Observation { id: string; auditId: string; itemCode: string | null; kind: 'negative'|'positive'|'site'; text: string; category: CategoryId | null; hasPhoto: boolean }
export interface Filter { quarter: Quarter | 'all'; regions: Subregion[]; contractorId?: string }  // contractorId not in URL; used by contractor profile
