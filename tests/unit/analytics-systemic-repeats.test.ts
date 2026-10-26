import { describe, expect, test } from 'vitest';
import { getRepo } from '@/lib/data/repo';
import {
  filterAudits, isNaObservation, rankedSystemicRepeats, repeatAudits, repeatContractors, repeatNotesPerAudit, repeatThreshold, systemicRepeats,
} from '@/lib/analytics';
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
      expect(r.minContractors).toBe(5);
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

  test('threshold scales with the eligible contractors: 5 of 7, 3 of 4, 3 of 3, never below 2', () => {
    expect(repeatThreshold(7)).toBe(5);
    expect(repeatThreshold(4)).toBe(3);
    expect(repeatThreshold(3)).toBe(3);
    expect(repeatThreshold(2)).toBe(2);
    expect(repeatThreshold(1)).toBe(2);
    expect(repeatThreshold(14)).toBe(10);
  });

  for (const region of ['SR1', 'SR2'] as const) {
    test(`single region ${region}: the scaled threshold finds repeats, all inside the region`, () => {
      const inRegion = new Set(repo.contractors().filter((c) => c.subregion === region).map((c) => c.id));
      const f: Filter = { quarter: 'all', regions: [region] };
      const eligible = repeatContractors(repo, f).length;
      const out = systemicRepeats(repo, f);
      expect(out.length).toBeGreaterThan(0);
      for (const r of out) {
        expect(r.eligibleContractors).toBe(eligible);
        expect(r.minContractors).toBe(repeatThreshold(eligible));
        expect(r.contractorCount).toBeGreaterThanOrEqual(r.minContractors);
        for (const c of r.contractors) expect(inRegion.has(c.id)).toBe(true);
      }
    });
  }

  test('SR1 has 4 eligible contractors (threshold 3), SR2 has 3 (threshold 3)', () => {
    expect(systemicRepeats(repo, { quarter: 'all', regions: ['SR1'] })[0].eligibleContractors).toBe(4);
    expect(systemicRepeats(repo, { quarter: 'all', regions: ['SR2'] })[0].eligibleContractors).toBe(3);
    for (const r of [...systemicRepeats(repo, { quarter: 'all', regions: ['SR1'] }), ...systemicRepeats(repo, { quarter: 'all', regions: ['SR2'] })]) {
      expect(r.minContractors).toBe(3);
    }
  });

  test('an explicit minimum still wins', () => {
    const out = systemicRepeats(repo, { quarter: 'all', regions: ['SR2'] }, 2);
    expect(out.length).toBeGreaterThanOrEqual(systemicRepeats(repo, { quarter: 'all', regions: ['SR2'] }).length);
    for (const r of out) expect(r.minContractors).toBe(2);
  });

  test('labels are non-empty and contain no codes', () => {
    for (const r of rows) {
      expect(r.label.length).toBeGreaterThan(0);
      expect(r.label).not.toMatch(/\b[ABC]\d+(\.\d+)?\b/);
    }
  });
});

describe('repeats notes per audit (the /repeats header)', () => {
  for (const f of [ALL, { quarter: 'all', regions: ['SR1'] }, { quarter: 'all', regions: ['SR2'] }] as Filter[]) {
    test(`numerator and denominator over the eligible contractors' audits only (${f.regions.join('+')})`, () => {
      const eligible = new Set(repeatContractors(repo, f).map((c) => c.id));
      const rows = systemicRepeats(repo, f);
      const codes = new Set(rows.map((r) => r.itemCode));
      const audits = repeatAudits(repo, f);
      for (const [key, q] of [['q4', 'Q4-2025'], ['q1', 'Q1-2026']] as const) {
        const pool = filterAudits(repo, { ...f, quarter: q }).filter((a) => eligible.has(a.contractorId));
        // denominator: every audit of the eligible contractors in the quarter, never the region's other audits
        expect(audits[key]).toBe(pool.length);
        expect(audits[key]).toBeLessThanOrEqual(filterAudits(repo, { ...f, quarter: q }).length);
        // numerator: (audit, question) pairs with an applicable negative note, over those same audits
        const ids = new Set(pool.map((a) => a.id));
        const pairs = new Set(
          repo.observations()
            .filter((o) => o.kind === 'negative' && o.itemCode && codes.has(o.itemCode) && ids.has(o.auditId) && !isNaObservation(repo, o))
            .map((o) => `${o.auditId}|${o.itemCode}`),
        );
        const notes = rows.reduce((s, r) => s + r[key === 'q4' ? 'q4Audits' : 'q1Audits'], 0);
        expect(notes).toBe(pairs.size);
        expect(repeatNotesPerAudit(rows, audits)[key]).toBeCloseTo(pairs.size / pool.length, 10);
      }
    });
  }

  test('a contractor audited in one quarter only adds neither notes nor audits', () => {
    const all = filterAudits(repo, { ...ALL, quarter: 'Q1-2026' }).length;
    const audits = repeatAudits(repo, ALL);
    // the dataset has Q1 audits from contractors without a Q4 audit: the old header divided by them too
    expect(audits.q1).toBeLessThan(all);
  });

  test('no audits → null rate', () => {
    expect(repeatNotesPerAudit([], { q4: 0, q1: 0 })).toEqual({ q4: null, q1: null });
  });
});
