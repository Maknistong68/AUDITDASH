import hs from '../data/seed/checklists/hs.json';
import security from '../data/seed/checklists/security.json';
import environmental from '../data/seed/checklists/environmental.json';
import welfare from '../data/seed/checklists/welfare.json';
import crc from '../data/seed/checklists/crc.json';
import { CATEGORIES } from './categories';
import type { AuditType, TypedChecklistItem, TypeSection } from './types';

export interface AuditTypeInfo { id: AuditType; label: string; short: string }

export const AUDIT_TYPES: AuditTypeInfo[] = [
  { id: 'hs', label: 'Health & Safety', short: 'H&S' },
  { id: 'security', label: 'Security', short: 'Security' },
  { id: 'environmental', label: 'Environmental', short: 'Environmental' },
  { id: 'welfare', label: 'Welfare', short: 'Welfare' },
  { id: 'crc', label: 'CRC', short: 'CRC' },
];

/** Category-like entry for any type: H&S uses the ten CategoryIds, other types use their sections (`security:A`). */
export interface TypeCategory { id: string; name: string; short: string; color: string; icon: string }

interface ChecklistFile { type: AuditType; sections: TypeSection[]; items: TypedChecklistItem[] }
const FILES: Record<AuditType, ChecklistFile> = {
  hs: hs as ChecklistFile, security: security as ChecklistFile, environmental: environmental as ChecklistFile,
  welfare: welfare as ChecklistFile, crc: crc as ChecklistFile,
};

export const isAuditType = (v: unknown): v is AuditType => AUDIT_TYPES.some((t) => t.id === v);

export function checklistFor(type: AuditType): TypedChecklistItem[] { return FILES[type].items; }

/** Sections (letter, title, category id) from the owner's workbook. H&S sections have category null. */
export function sectionsFor(type: AuditType): TypeSection[] { return FILES[type].sections; }

/** Section hues cycle the H&S palette; sections are always labelled, so colour is decorative. */
export function categoriesFor(type: AuditType): TypeCategory[] {
  if (type === 'hs') return CATEGORIES;
  return FILES[type].sections.map((s, i) => ({
    id: s.category as string,
    name: s.title,
    short: s.title.length > 18 ? `${s.title.slice(0, 17).trimEnd()}…` : s.title,
    color: CATEGORIES[i % CATEGORIES.length].color,
    icon: 'ClipboardCheck',
  }));
}
