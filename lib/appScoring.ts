import { sectionsFor } from './auditTypes';
import { scoreResponses } from './scoring';
import type { AppAnswer, AuditType, ChecklistItem, Compliance, TypedChecklistItem } from './types';

/* Imports the checklist JSON (via sectionsFor): server code and the audit wizard only. */

const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

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
