import contractorsSeed from '../../data/seed/contractors.json';
import type { Contractor, Subregion } from '../types';

/**
 * The contractor register as imported (data/contractors.csv → data/seed/contractors.json): each contractor's project
 * names ("Project:" strings in the workbooks), status and current sub-region. One list for the importer and the app.
 */
export const CONTRACTORS = contractorsSeed as Contractor[];

const norm = (raw: string) => raw.replace(/\s+/g, ' ').trim();

const BY_ALIAS = new Map<string, string>(CONTRACTORS.flatMap((c) => c.aliases.map((a) => [norm(a), c.id] as [string, string])));

/** Contract number for a raw project string (a project name, else the one contract number in it), or null: the auditor picks it. */
export function contractorForProject(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const hit = BY_ALIAS.get(norm(raw));
  if (hit) return hit;
  const digits = norm(raw).replace(/\D/g, ' ').split(' ');
  const nos = CONTRACTORS.filter((c) => digits.includes(c.contractNo));
  return nos.length === 1 ? nos[0].id : null;
}

/** The sub-region for an entered audit: named in its location ("Sub Region 2 - …"), else where the contractor last was. */
export function subregionFor(location: string, contractorId: string | null): Subregion | null {
  const m = /sub\s*-?\s*region\s*(\d+)/i.exec(location);
  if (m) return `SR${Number(m[1])}`;
  return CONTRACTORS.find((c) => c.id === contractorId)?.subregion ?? null;
}
