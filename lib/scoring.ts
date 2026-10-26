import type { Band, ChecklistItem, Compliance } from './types';

const VALUE: Record<Exclude<Compliance, 'na'>, number> = { full: 1, partial: 0.5, no: 0 };

interface Acc { w: number; wv: number }
const add = (m: Map<string, Acc>, key: string, w: number, v: number) => {
  const a = m.get(key) ?? { w: 0, wv: 0 };
  a.w += w; a.wv += w * v;
  m.set(key, a);
};
const ratio = (a: Acc) => a.wv / a.w;
const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/** C item -> "C1" | "C2" (from subsection, else code prefix). */
function cSub(item: ChecklistItem): string {
  return item.subsection ?? item.code.split('.')[0];
}

/**
 * Overall score = mean of section scores A, B, C.
 * A = Σw·v/Σw over applicable A items; B = Σw·v/Σw over all applicable B items;
 * C = mean(C1, C2), each Σw·v/Σw. N/A (and unanswered) items are excluded; a section or
 * C subsection with no applicable items is dropped from its mean; nothing applicable => null.
 * `possible`/`scored` are the raw weighted sums over all applicable items (informational).
 */
export function scoreResponses(
  items: ChecklistItem[],
  responses: Record<string, Compliance>,
): { score: number | null; possible: number; scored: number } {
  const secs = new Map<string, Acc>();
  const cSubs = new Map<string, Acc>();
  let possible = 0;
  let scored = 0;
  for (const item of items) {
    const r = responses[item.code];
    if (r === undefined || r === 'na') continue;
    const v = VALUE[r];
    possible += item.weight;
    scored += item.weight * v;
    if (item.section === 'C') add(cSubs, cSub(item), item.weight, v);
    else add(secs, item.section, item.weight, v);
  }
  const parts: number[] = [];
  const a = secs.get('A'); if (a) parts.push(ratio(a));
  const b = secs.get('B'); if (b) parts.push(ratio(b));
  const c = mean([...cSubs.values()].map(ratio));
  if (c !== null) parts.push(c);
  return { score: mean(parts), possible, scored };
}

/** Score as a fraction (0..1). Bands: ≥90 Excellent, ≥80 Good, ≥70 Partially, ≥60 Minimally, else Non-Compliant. */
export function bandFor(score: number): Band {
  const pct = score * 100;
  if (pct >= 90) return 'Excellent';
  if (pct >= 80) return 'Good';
  if (pct >= 70) return 'Partially Compliant';
  if (pct >= 60) return 'Minimally Compliant';
  return 'Non-Compliant';
}
