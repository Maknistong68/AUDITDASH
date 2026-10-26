import { describe, expect, test } from 'vitest';
import { getRepo } from '@/lib/data/repo';
import { rankedSystemicRepeats, systemicRepeats } from '@/lib/analytics';
import type { Filter } from '@/lib/types';

const repo = getRepo();
const ALL: Filter = { quarter: 'all', regions: ['SR1', 'SR2'] };

describe('systemicRepeats', () => {
  const rows = systemicRepeats(repo, ALL);

  test('filter all: exactly 28 items, each at >= 5 contractors', () => {
    expect(rows).toHaveLength(28);
    for (const r of rows) {
      expect(r.contractorCount).toBeGreaterThanOrEqual(5);
      expect(r.contractors).toHaveLength(r.contractorCount);
      expect(r.sectionScores).toHaveLength(r.contractorCount);
      for (const s of r.sectionScores) for (const v of [s.q4, s.q1]) expect(v === null || Number.isFinite(v)).toBe(true);
      expect(Number.isFinite(r.q4Notes) && Number.isFinite(r.q1Notes)).toBe(true);
    }
  });

  test('eligibleContractors is 7 for filter all', () => {
    for (const r of rows) expect(r.eligibleContractors).toBe(7);
  });

  test('sorted by contractorCount desc, then impact desc, then code (numeric); contractors by name', () => {
    const ranked = rankedSystemicRepeats(repo, ALL);
    expect(ranked.map((r) => r.itemCode)).toEqual(rows.map((r) => r.itemCode));
    for (let i = 1; i < ranked.length; i++) {
      const [a, b] = [ranked[i - 1], ranked[i]];
      expect(a.contractorCount).toBeGreaterThanOrEqual(b.contractorCount);
      if (a.contractorCount === b.contractorCount) expect(a.impact).toBeGreaterThanOrEqual(b.impact);
      if (a.contractorCount === b.contractorCount && a.impact === b.impact) {
        expect(a.itemCode.localeCompare(b.itemCode, undefined, { numeric: true })).toBeLessThan(0);
      }
    }
    for (const r of rows) {
      const names = r.contractors.map((c) => c.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    }
  });

  test('Q4-2025, non-hs type and empty regions give []', () => {
    expect(systemicRepeats(repo, { ...ALL, quarter: 'Q4-2025' })).toEqual([]);
    expect(systemicRepeats(repo, { ...ALL, type: 'other' as never })).toEqual([]);
    expect(systemicRepeats(repo, { quarter: 'all', regions: [] })).toEqual([]);
  });

  test('regions SR2 respected', () => {
    const sr2 = new Set(repo.contractors().filter((c) => c.subregion === 'SR2').map((c) => c.id));
    // SR2 has only 3 contractors: the default (>= 5) can never match.
    expect(systemicRepeats(repo, { quarter: 'all', regions: ['SR2'] })).toEqual([]);
    const out = systemicRepeats(repo, { quarter: 'all', regions: ['SR2'] }, 2);
    expect(out.length).toBeGreaterThan(0);
    for (const r of out) {
      for (const c of r.contractors) expect(sr2.has(c.id)).toBe(true);
      expect(r.eligibleContractors).toBeLessThanOrEqual(3);
    }
  });

  test('labels are non-empty and contain no codes', () => {
    for (const r of rows) {
      expect(r.label.length).toBeGreaterThan(0);
      expect(r.label).not.toMatch(/\b[ABC]\d+(\.\d+)?\b/);
    }
  });
});
