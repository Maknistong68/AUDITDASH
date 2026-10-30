import { categoryForCode } from '@/lib/categories';
import type { AuditType, CategoryId } from '@/lib/types';

/** finding = a note on a checklist item; site = Site / Other finding (no code); positive = good practice seen. */
export type NoteKind = 'finding' | 'site' | 'positive';

/** Ported from scripts/site_keywords.py: first matching group wins, else Site. */
const KEYWORDS: [CategoryId, RegExp][] = [
  ['competence', /training|competen|certificat/i],
  ['health', /mosquito|toilet|clinic|medicin|nurse|first aid|\bheat\b|\bwater\b/i],
];

/** Category of a site / other finding (no checklist code) from its words. */
export function siteCategory(text: string): CategoryId {
  for (const [cat, re] of KEYWORDS) if (re.test(text)) return cat;
  return 'site';
}

/**
 * The automatic category of a note (site_keywords.category_for): positives have none; a checklist code maps through
 * lib/categories; a note without a code is categorised by keywords like a site finding.
 */
export function autoCategory(code: string | null, kind: NoteKind, text: string): CategoryId | null {
  if (kind === 'positive') return null;
  if (code) return categoryForCode(code);
  return siteCategory(text);
}

/** autoCategory for any audit type: only H&S codes map to categories; other types' notes go by their words. */
export function autoCategoryFor(type: AuditType, code: string | null, kind: NoteKind, text: string): CategoryId | null {
  return type === 'hs' ? autoCategory(code, kind, text) : autoCategory(null, kind, text);
}
