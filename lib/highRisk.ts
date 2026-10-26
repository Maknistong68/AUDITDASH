import type { Observation, Quarter } from './types';

/** High-risk work keywords (case-insensitive, word-start boundary, suffixes allowed: cranes, scaffolding). */
export const HIGH_RISK_KEYWORDS = /\b(lifting|crane|excavation|height|scaffold|harness|electrical|earthing|confined|hot work|LPG|gas cylinder)/i;

/** Permit / utility-clearance checklist item (B4.*, B5.*). */
const PERMIT_ITEM = /^B[45]\./;

/** Permit / utility-clearance item (B4.*, B5.*), or a site finding mentioning a high-risk keyword. */
export function isHighRisk(o: Observation): boolean {
  return PERMIT_ITEM.test(o.itemCode ?? '') || (o.kind === 'site' && HIGH_RISK_KEYWORDS.test(o.text));
}

export type HazardId = 'lifting' | 'height' | 'electrical' | 'excavation' | 'confined' | 'hotwork' | 'permits' | 'other';

/**
 * The hazard types of /high-risk, in display order. The keyword families split HIGH_RISK_KEYWORDS (together they cover
 * every keyword); permit / utility-clearance items (B4/B5) naming no hazard are a type of their own; "other" catches
 * anything left.
 */
export const HAZARDS: { id: HazardId; label: string; keywords?: RegExp }[] = [
  { id: 'lifting', label: 'Lifting & cranes', keywords: /\b(lifting|crane)/i },
  { id: 'height', label: 'Work at height', keywords: /\b(height|scaffold|harness)/i },
  { id: 'electrical', label: 'Electrical', keywords: /\b(electrical|earthing)/i },
  { id: 'excavation', label: 'Excavation', keywords: /\bexcavation/i },
  { id: 'confined', label: 'Confined space', keywords: /\bconfined/i },
  { id: 'hotwork', label: 'Hot work & gas', keywords: /\b(hot work|LPG|gas cylinder)/i },
  { id: 'permits', label: 'Permits & utility clearance' },
  { id: 'other', label: 'Other' },
];

export const isHazardId = (s: string | null | undefined): s is HazardId => HAZARDS.some((h) => h.id === s);

/**
 * The one hazard type of a high-risk observation, keyword first: the keyword family that appears first in its text
 * (a hot work permit item is "Hot work & gas"); a permit / utility item (B4/B5) that names no hazard is "permits";
 * anything else "other".
 */
export function hazardOf(o: Observation): HazardId {
  let best: { id: HazardId; at: number } | null = null;
  for (const h of HAZARDS) {
    const m = h.keywords?.exec(o.text);
    if (m && (!best || m.index < best.at)) best = { id: h.id, at: m.index };
  }
  return best?.id ?? (PERMIT_ITEM.test(o.itemCode ?? '') ? 'permits' : 'other');
}

/** One contractor's high-risk findings per quarter of the filter (only quarters it was audited in). */
export interface HighRiskContractor {
  id: string;
  name: string;
  quarters: { quarter: Quarter; audits: number; findings: number; byHazard: Partial<Record<HazardId, number>> }[];
}

export interface HighRiskRank {
  id: string;
  name: string;
  /** Findings per audit in the contractor's latest quarter, and that quarter. */
  now: number;
  nowQuarter: Quarter;
  /** Findings per audit in the quarter before, when it was audited in both. */
  past: number | null;
  findings: number;
}

/**
 * Contractors ranked by high-risk findings per audit in their latest quarter (optionally one hazard type), worst first;
 * ties by the earlier quarter's rate, then name. Pure: runs on the client when the hazard filter changes.
 */
export function rankHighRisk(rows: HighRiskContractor[], hazard: HazardId | null = null): HighRiskRank[] {
  const count = (q: HighRiskContractor['quarters'][number]) => (hazard ? (q.byHazard[hazard] ?? 0) : q.findings);
  return rows
    .filter((r) => r.quarters.some((q) => q.audits > 0))
    .map((r) => {
      const qs = r.quarters.filter((q) => q.audits > 0);
      const last = qs.at(-1)!;
      const prev = qs.length > 1 ? qs.at(-2)! : null;
      return {
        id: r.id,
        name: r.name,
        now: count(last) / last.audits,
        nowQuarter: last.quarter,
        past: prev ? count(prev) / prev.audits : null,
        findings: qs.reduce((s, q) => s + count(q), 0),
      };
    })
    .sort((a, b) => b.now - a.now || (b.past ?? -1) - (a.past ?? -1) || a.name.localeCompare(b.name));
}
