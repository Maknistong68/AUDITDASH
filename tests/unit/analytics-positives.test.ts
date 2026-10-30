import { describe, expect, test } from 'vitest';
import { getRepo } from '@/lib/data/repo';
import { filterAudits, positiveNotes, positiveSummary, positivesByContractor } from '@/lib/analytics';
import type { Filter } from '@/lib/types';

const repo = getRepo();
const ALL: Filter = { quarter: 'all', regions: ['SR1', 'SR2'] };
const NONE: Filter = { quarter: 'all', regions: [] };

describe('positiveSummary', () => {
  test('seed: 138 positives in 18 of 20 audits, 11 of 12 contractors', () => {
    expect(positiveSummary(repo, ALL)).toEqual({ total: 138, audits: 20, auditsWith: 18, contractors: 12, contractorsWith: 11 });
  });
  test('per quarter: 92 in Q4, 46 in Q1; they add up', () => {
    expect(positiveSummary(repo, { ...ALL, quarter: 'Q4-2025' }).total).toBe(92);
    expect(positiveSummary(repo, { ...ALL, quarter: 'Q1-2026' }).total).toBe(46);
  });
  test('empty filter and other audit types: zeros', () => {
    for (const f of [NONE, { ...ALL, type: 'security' as const }]) {
      expect(positiveSummary(repo, f)).toEqual({ total: 0, audits: 0, auditsWith: 0, contractors: 0, contractorsWith: 0 });
    }
  });
});

describe('positivesByContractor', () => {
  const rows = positivesByContractor(repo, ALL);
  test('every audited contractor once; counts add up to the total', () => {
    expect(rows).toHaveLength(12);
    expect(rows.reduce((s, r) => s + r.count, 0)).toBe(138);
    expect(rows.reduce((s, r) => s + r.audits, 0)).toBe(filterAudits(repo, ALL).length);
  });
  test('most per audit first; none recorded last', () => {
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].perAudit).toBeGreaterThanOrEqual(rows[i].perAudit);
    expect(rows.at(-1)!.count).toBe(0);
    for (const r of rows) expect(r.perAudit).toBeCloseTo(r.count / r.audits, 10);
  });
});

describe('positiveNotes', () => {
  test('all of them, newest audit first, positive only', () => {
    const notes = positiveNotes(repo, ALL);
    expect(notes).toHaveLength(138);
    for (let i = 1; i < notes.length; i++) expect(notes[i - 1].date >= notes[i].date).toBe(true);
    const ids = new Set(repo.observations().filter((o) => o.kind === 'positive').map((o) => o.id));
    for (const n of notes) expect(ids.has(n.id)).toBe(true);
  });
});
