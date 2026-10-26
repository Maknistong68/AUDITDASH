import { sectionsFor } from './auditTypes';
import type { AppAnswer, AuditType, Band, ChecklistItem, Compliance, TypedChecklistItem } from './types';

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

const APP_VALUE: Record<Exclude<AppAnswer, 'na'>, number> = { compliant: 1, observation: 0.5, non_compliant: 0 };
const TO_COMPLIANCE: Record<AppAnswer, Compliance> = { compliant: 'full', observation: 'partial', non_compliant: 'no', na: 'na' };

export interface AppScore {
  score: number | null;
  sections: { code: string; title: string; score: number | null }[];
  counts: { compliant: number; nonCompliant: number; observation: number; na: number; unanswered: number };
}

/**
 * Score an audit entered in the app. Compliant 1, Observation 0.5, Non-Compliant 0; N/A and unanswered excluded.
 * H&S: the organisation formula (mean of A, B, C with C = mean(C1, C2)) via scoreResponses.
 * Other types: mean of section scores, each Σw·v/Σw over answered applicable items; sections with none are dropped.
 */
export function scoreAppAudit(type: AuditType, items: TypedChecklistItem[], answers: Record<string, AppAnswer>): AppScore {
  const counts = { compliant: 0, nonCompliant: 0, observation: 0, na: 0, unanswered: 0 };
  for (const i of items) {
    const a = answers[i.code];
    if (a === undefined) counts.unanswered++;
    else if (a === 'na') counts.na++;
    else if (a === 'compliant') counts.compliant++;
    else if (a === 'observation') counts.observation++;
    else counts.nonCompliant++;
  }
  const defs = sectionsFor(type);
  if (type === 'hs') {
    const hs = items as unknown as ChecklistItem[];
    const resp: Record<string, Compliance> = {};
    for (const i of items) if (answers[i.code]) resp[i.code] = TO_COMPLIANCE[answers[i.code]];
    return {
      score: scoreResponses(hs, resp).score,
      sections: defs.map((d) => ({ code: d.code, title: d.title, score: scoreResponses(hs.filter((i) => i.section === d.code), resp).score })),
      counts,
    };
  }
  const sections = defs.map((d) => {
    let w = 0;
    let wv = 0;
    for (const i of items) {
      const a = answers[i.code];
      if (i.section !== d.code || a === undefined || a === 'na') continue;
      w += i.weight;
      wv += i.weight * APP_VALUE[a];
    }
    return { code: d.code, title: d.title, score: w > 0 ? wv / w : null };
  });
  return { score: mean(sections.flatMap((s) => (s.score === null ? [] : [s.score]))), sections, counts };
}
