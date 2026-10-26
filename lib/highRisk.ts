import type { Observation } from './types';

/** High-risk work keywords (case-insensitive, word-start boundary, suffixes allowed: cranes, scaffolding). */
export const HIGH_RISK_KEYWORDS = /\b(lifting|crane|excavation|height|scaffold|harness|electrical|earthing|confined|hot work|LPG|gas cylinder)/i;

/** Permits-category observation, or a site observation mentioning a high-risk keyword. */
export function isHighRisk(o: Observation): boolean {
  return o.category === 'permits' || (o.kind === 'site' && HIGH_RISK_KEYWORDS.test(o.text));
}
