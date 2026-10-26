import type { Category, CategoryId } from './types';

/**
 * Category hues are the dataviz skill's validated categorical palette
 * (slots 1-8 verbatim, re-validated for the 8-category order with
 * scripts/validate_palette.js: light + dark pass lightness band, chroma floor,
 * adjacent CVD and normal-vision separation). Fixed order, never cycled.
 * `color` is the light-theme step; CATEGORY_COLORS_DARK holds the dark-theme step.
 * Some light steps are < 3:1 on the surface, so always pair colour with icon/label.
 */
export const CATEGORIES: Category[] = [
  { id: 'leadership',    name: 'Leadership & Commitment',          short: 'Leadership',    color: '#2a78d6', icon: 'Flag' },
  { id: 'documents',     name: 'Documents',                        short: 'Documents',     color: '#eda100', icon: 'FileText' },
  { id: 'competence',    name: 'Competence & Training',            short: 'Competence',    color: '#e87ba4', icon: 'GraduationCap' },
  { id: 'subcontractor', name: 'Subcontractor Control',            short: 'Subcontractors', color: '#008300', icon: 'Users' },
  { id: 'monitoring',    name: 'Monitoring & Corrective Action',   short: 'Monitoring',    color: '#6250d6', icon: 'Eye' },
  { id: 'incident',      name: 'Incident & Emergency Readiness',   short: 'Emergency',     color: '#e34948', icon: 'Siren' },
  { id: 'site',          name: 'Site Compliance',                short: 'Site',          color: '#1496ad', icon: 'HardHat' },
  { id: 'health',        name: 'Health & Welfare',                 short: 'Health',        color: '#a3592b', icon: 'HeartPulse' },
];

export const CATEGORY_COLORS_DARK: Record<CategoryId, string> = {
  leadership: '#3987e5', documents: '#c98500', competence: '#d55181',
  subcontractor: '#008300', monitoring: '#9085e9', incident: '#e66767', site: '#1da1b6', health: '#c27a4a',
};

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function categoryById(id: CategoryId): Category {
  const c = BY_ID.get(id);
  if (!c) throw new Error(`Unknown category: ${id}`);
  return c;
}

const CODE_MAP: Record<string, CategoryId> = {};
function assign(id: CategoryId, codes: string[]) { for (const c of codes) CODE_MAP[c] = id; }
const range = (prefix: string, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${from + i}`);

assign('leadership', ['A9', 'A11', 'A12', 'A15', 'C1.1', 'C1.2', 'C1.3', 'C1.5', 'C1.7', 'C1.8', 'C2.6']);
assign('documents', [
  'A1', 'A2', 'A6', 'A13', ...range('C2.', 2, 5), ...range('C2.', 7, 19),
  'B1.1', 'B1.2', ...range('C1.', 9, 12),
  'B4.1', 'B4.2', 'B5.1', 'B5.2', 'B5.3',
]);
assign('competence', ['A3', 'B2.1', 'B2.2', 'B2.3', 'B2.4', 'B6.7', 'B7.1', 'B7.2']);
assign('subcontractor', ['B6.1', 'B6.2', 'B6.3', 'B6.4', 'B6.5', 'B6.6', 'B6.9']);
assign('monitoring', ['A4', 'A5', 'A8', 'A10', 'A14', 'C1.4', 'C1.6']);
assign('incident', ['A7', 'B3.1', 'B3.2', 'B3.3', 'B8.1']);
assign('site', ['B6.8', 'B9.1', 'B9.2', 'B9.3', 'B10.1', 'B10.2']);
assign('health', ['B11.1', 'B11.2', 'B11.3', 'B12.1', 'B12.2']);

/** Deterministic code -> category map; unmapped codes default to "site" ("Other / Site Findings"). */
export function categoryForCode(code: string): CategoryId {
  return CODE_MAP[code] ?? 'site';
}
