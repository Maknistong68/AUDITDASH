import { describe, expect, test } from 'vitest';
import { getRepo } from '@/lib/data/repo';
import {
  bandDistribution, categoryDetail, categoryGaps, compareContractors, mainProblem, contractorCards, filterAudits, regionComparison,
} from '@/lib/analytics';
import { CATEGORIES } from '@/lib/categories';
import type { Filter } from '@/lib/types';

const repo = getRepo();

const ALL: Filter = { quarter: 'all', regions: ['SR1', 'SR2'] };
const NONE: Filter = { quarter: 'all', regions: [] };

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
    out.forEach((x) => { expect(x.gaps).toHaveLength(CATEGORIES.length); x.repeats.forEach((r) => expect(r.contractor.id).toBe(x.card.contractor.id)); });
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

describe('mainProblem', () => {
  test('filter all -> latest quarter Q1-2026, worst category of that quarter', () => {
    const m = mainProblem(repo, ALL)!;
    expect(m.quarter).toBe('Q1-2026');
    const q1 = categoryGaps(repo, { ...ALL, quarter: 'Q1-2026' });
    const worst = q1.filter((g) => g.gapRate !== null).sort((a, b) => b.gapRate! - a.gapRate!)[0];
    expect(m.category).toBe(worst.category);
    expect(m.gapRate).toBeCloseTo(worst.gapRate!, 10);
    const q4 = categoryGaps(repo, { ...ALL, quarter: 'Q4-2025' }).find((g) => g.category === m.category)!;
    expect(m.prevGapRate).toBeCloseTo(q4.gapRate!, 10);
    expect(m.items.length).toBeLessThanOrEqual(3);
    expect(m.items).toEqual(categoryDetail(repo, { ...ALL, quarter: 'Q1-2026' }, m.category).items.slice(0, 3));
  });
  test('driving items are ranked by impact = audits noted x mean subsection score lost', () => {
    const m = mainProblem(repo, ALL)!;
    const q1 = repo.audits().filter((a) => a.quarter === 'Q1-2026');
    for (const it of m.items) {
      const item = repo.checklist().find((i) => i.code === it.itemCode)!;
      const sub = item.subsection ?? item.section;
      const hit = q1.filter((a) => repo.observations().some((o) => o.auditId === a.id && o.itemCode === it.itemCode && o.kind === 'negative'));
      expect(it.hits).toBe(hit.length);
      const ratios = hit.map((a) => a.sections.find((x) => x.code === sub)!).filter((x) => x.possible > 0).map((x) => x.scored / x.possible);
      const severity = 1 - ratios.reduce((s, r) => s + r, 0) / ratios.length;
      expect(it.severity).toBeCloseTo(severity, 10);
      expect(it.impact).toBeCloseTo(it.hits * severity, 10);
    }
    const imp = m.items.map((i) => i.impact);
    expect(imp).toEqual([...imp].sort((a, b) => b - a));
  });
  test('first quarter has no previous', () => {
    const m = mainProblem(repo, { ...ALL, quarter: 'Q4-2025' })!;
    expect(m.quarter).toBe('Q4-2025');
    expect(m.prevGapRate).toBeNull();
  });
  test('empty filter -> null', () => expect(mainProblem(repo, NONE)).toBeNull());
});
