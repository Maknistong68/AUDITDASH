/**
 * Contractor alias table, ported from scripts/contractors.py: every raw `Project:` string seen in the workbooks
 * -> contract number (the contractor id in data/seed/contractors.json). Keep both tables in step.
 */
const ALIASES: Record<string, string[]> = {
  '4800001134': ['4800001134-ABYATONA'],
  '4800001112': ['4800001112-ABYATONA'],
  '4800000901': ['480000901-AL-BIRIKI'],
  '4800000838': ['SIBS 838', 'SIBS - 4800000838', '800000838-SIBS'],
  '4800001322': ['4800001322-PPCO'],
  '4800000882': ['4800000882-AL FAHD'],
  '4200000026': ['4200000026 - NBC'],
  '4800001440': ['4800001440-RPCO'],
  '4800000892': ['4800000892-TDP'],
  '4800001272': ['AL FAHD-4800001272'],
  '4800001131': ['JV-ECH-T1-4800001131'],
  '4800000876': ['Design and Build for OXAGON Terminal 2 (T2) Dredging and Quay Walls-D&B', 'Sarco Disa - 4800000876'],
};

const norm = (raw: string) => raw.replace(/\s+/g, ' ').trim();

const BY_ALIAS = new Map<string, string>(
  Object.entries(ALIASES).flatMap(([no, list]) => list.map((a) => [norm(a), no] as [string, string])),
);

/** Contract number for a raw project string (exact alias, whitespace-normalised), or null: the auditor picks it. */
export function contractorForProject(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return BY_ALIAS.get(norm(raw)) ?? null;
}
