import { describe, expect, test } from 'vitest';
import { getRepo } from '@/lib/data/repo';
import {
  bandDistribution, categoryGaps, compareContractors, contractorCards, filterAudits, highRiskCount, regionComparison, repeatFindings,
} from '@/lib/analytics';
import { isHighRisk } from '@/lib/highRisk';
import type { Filter, Observation } from '@/lib/types';

const repo = getRepo();
const ALL: Filter = { quarter: 'all', regions: ['SR1', 'SR2'] };
const NONE: Filter = { quarter: 'all', regions: [] };
const obs = (text: string, kind: Observation['kind'], category: Observation['category'] = null): Observation =>
  ({ id: 'x', auditId: 'a', itemCode: null, kind, text, category, hasPhoto: false });

describe('contractorCards', () => {
  test('JV-ECH card', () => {
    const c = contractorCards(repo, ALL).find((x) => x.contractor.id === '4800001131')!;
    expect(c.total).toBe(0.85);
    expect(c.previous).toBe(0.74);
    expect(c.rank).toBe(1);
    expect(c.band).toBe('Good');
  });
  test('rings in [0,1] or null; sorted desc; ranks valid', () => {
    const cards = contractorCards(repo, ALL);
    expect(cards.length).toBeGreaterThan(0);
    cards.forEach((c) => Object.values(c.rings).forEach((r) => r === null || (expect(r).toBeGreaterThanOrEqual(0), expect(r).toBeLessThanOrEqual(1))));
    expect(cards.map((c) => c.total)).toEqual([...cards.map((c) => c.total)].sort((a, b) => b - a));
    cards.forEach((c) => expect(c.rank).toBe(cards.findIndex((x) => x.total === c.total) + 1));
  });
  test('rings come from A/B/C section scores', () => {
    const c = contractorCards(repo, ALL)[0];
    const a = repo.audits().find((x) => x.id === c.auditId)!;
    const A = a.sections.find((s) => s.code === 'A')!;
    expect(c.rings.A).toBeCloseTo(A.scored / A.possible, 10);
  });
  test('empty -> []', () => expect(contractorCards(repo, NONE)).toEqual([]));
});

describe('bandDistribution', () => {
  test('sums to contractors with audits, all keys', () => {
    const d = bandDistribution(repo, ALL);
    expect(Object.keys(d)).toEqual(['Excellent', 'Good', 'Partially Compliant', 'Minimally Compliant', 'Non-Compliant']);
    expect(Object.values(d).reduce((a, b) => a + b, 0)).toBe(contractorCards(repo, ALL).length);
  });
  test('empty -> zeros', () => Object.values(bandDistribution(repo, NONE)).forEach((v) => expect(v).toBe(0)));
});

describe('repeatFindings', () => {
  test('empty for Q4-2025', () => expect(repeatFindings(repo, { ...ALL, quarter: 'Q4-2025' })).toEqual([]));
  test('every contractor has audits in both quarters; no null/N-A codes', () => {
    const r = repeatFindings(repo, ALL);
    expect(r.length).toBeGreaterThan(0);
    r.forEach((x) => {
      const qs = new Set(repo.audits().filter((a) => a.contractorId === x.contractor.id).map((a) => a.quarter));
      expect(qs.size).toBe(2);
      expect(x.quarters).toEqual(['Q4-2025', 'Q1-2026']);
      expect(x.itemCode).toBeTruthy();
    });
    expect(new Set(r.map((x) => `${x.contractor.id}|${x.itemCode}`)).size).toBe(r.length);
  });
  test('worst contractor first', () => {
    const totals = new Map(contractorCards(repo, ALL).map((c) => [c.contractor.id, c.total]));
    const t = repeatFindings(repo, ALL).map((x) => totals.get(x.contractor.id)!);
    expect(t).toEqual([...t].sort((a, b) => a - b));
  });
  test('Q1 filter works; empty filter -> []', () => {
    expect(repeatFindings(repo, { ...ALL, quarter: 'Q1-2026' }).length).toBeGreaterThan(0);
    expect(repeatFindings(repo, NONE)).toEqual([]);
  });
});

describe('high risk', () => {
  test('keywords', () => {
    expect(isHighRisk(obs('Tower light found operational without earthing', 'site'))).toBe(true);
    expect(isHighRisk(obs('Mosquito presence', 'site'))).toBe(false);
    expect(isHighRisk(obs('Mobile CRANES operating', 'site'))).toBe(true);
    expect(isHighRisk(obs('anything', 'negative', 'permits'))).toBe(true);
  });
  test('count', () => {
    expect(highRiskCount(repo, ALL)).toBeGreaterThan(0);
    expect(highRiskCount(repo, NONE)).toBe(0);
    expect(highRiskCount(repo, { ...ALL, quarter: 'Q4-2025' })).toBeLessThan(highRiskCount(repo, ALL));
  });
  test('N/A permits notes excluded', () => {
    const f: Filter = { quarter: 'Q1-2026', regions: ['SR1', 'SR2'], contractorId: '4800000892' };
    const raw = repo.observations().filter((o) => o.auditId === '4800000892-Q1-2026-20260315' && o.kind !== 'positive' && isHighRisk(o));
    const na = raw.filter((o) => o.itemCode?.startsWith('B5.')).length;
    expect(na).toBeGreaterThan(0);
    expect(highRiskCount(repo, f)).toBe(raw.length - na);
  });
});

describe('regionComparison', () => {
  test('both regions, both quarter keys', () => {
    const r = regionComparison(repo, ALL);
    expect(r.map((x) => x.region)).toEqual(['SR1', 'SR2']);
    r.forEach((x) => expect(Object.keys(x.byQuarter).sort()).toEqual(['Q1-2026', 'Q4-2025']));
  });
  test('ignores quarter filter, respects regions', () => {
    expect(regionComparison(repo, { ...ALL, quarter: 'Q4-2025' })).toEqual(regionComparison(repo, ALL));
    expect(regionComparison(repo, { ...ALL, regions: ['SR2'] }).map((x) => x.region)).toEqual(['SR2']);
    expect(regionComparison(repo, NONE)).toEqual([]);
  });
});

describe('compareContractors', () => {
  test('keeps order, skips unknown, caps at 3', () => {
    const ids = contractorCards(repo, ALL).map((c) => c.contractor.id);
    const out = compareContractors(repo, ALL, [ids[2], 'nope', ids[0], ids[1], ids[3]]);
    expect(out.map((x) => x.card.contractor.id)).toEqual([ids[2], ids[0], ids[1]]);
    out.forEach((x) => { expect(x.gaps).toHaveLength(10); x.repeats.forEach((r) => expect(r.contractor.id).toBe(x.card.contractor.id)); });
  });
  test('gaps come from the latest audit only (same scope as rings and total)', () => {
    const id = '4800001131'; // JV-ECH: audited in Q4 2025 and Q1 2026
    expect(filterAudits(repo, { ...ALL, contractorId: id })).toHaveLength(2);
    const [x] = compareContractors(repo, ALL, [id]);
    const latestOnly = categoryGaps(repo, { quarter: 'Q1-2026', regions: ['SR1', 'SR2'], contractorId: id });
    const both = categoryGaps(repo, { ...ALL, contractorId: id });
    expect(x.gaps.map((g) => g.gapRate)).toEqual(latestOnly.map((g) => g.gapRate));
    expect(x.gaps.map((g) => g.gapRate)).not.toEqual(both.map((g) => g.gapRate));
    expect(x.gaps.map((g) => g.findings)).toEqual(latestOnly.map((g) => g.findings));
    // previous-audit gap is reported for comparison
    const q4 = categoryGaps(repo, { quarter: 'Q4-2025', regions: ['SR1', 'SR2'], contractorId: id });
    expect(x.gaps.map((g) => g.prevGapRate)).toEqual(q4.map((g) => g.gapRate));
  });
  test('empty -> []', () => expect(compareContractors(repo, NONE, ['4800001131'])).toEqual([]));
  test('sanity: filterAudits unaffected', () => expect(filterAudits(repo, ALL)).toHaveLength(20));
});
