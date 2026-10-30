import { describe, expect, test } from 'vitest';
import { getRepo } from '@/lib/data/repo';
import {
  auditItemStates, bandDistribution, categoryDetail, categoryGaps, compareContractors, findingsByAudit, isFinding, mainProblem, portfolioSummary, contractorCards, filterAudits, regionComparison,
} from '@/lib/analytics';
import { CATEGORIES } from '@/lib/categories';
import type { Filter } from '@/lib/types';

const repo = getRepo();

const ALL: Filter = { quarter: 'all', regions: ['SR1', 'SR2'] };
const NONE: Filter = { quarter: 'all', regions: [] };

describe('contractorCards', () => {
  test('JV-ECH card', () => {
    const c = contractorCards(repo, ALL).find((x) => x.contractor.id === '4800001131')!;
    // Computed from the Excel's own points; the Excel typed 85% and 74%.
    expect(c.total).toBe(0.7446);
    expect(c.previous).toBe(0.7604);
    expect(c.rank).toBe(1);
    expect(c.band).toBe('Partially Compliant');
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
  test('history: every audit of the contractor in date order, quarter filter ignored, regions respected', () => {
    for (const f of [ALL, { ...ALL, quarter: 'Q1-2026' } as Filter, { ...ALL, quarter: 'Q4-2025' } as Filter]) {
      const cards = contractorCards(repo, f);
      const jv = cards.find((x) => x.contractor.id === '4800001131')!;
      expect(jv.history.map((h) => h.total)).toEqual([0.7604, 0.7446]);
      for (const c of cards) {
        const all = repo.audits().filter((a) => a.contractorId === c.contractor.id);
        expect(c.history).toHaveLength(all.length);
        expect(c.history.map((h) => h.date)).toEqual([...c.history.map((h) => h.date)].sort());
      }
    }
    const nbc = contractorCards(repo, ALL).find((x) => x.contractor.name === 'NBC')!;
    expect(nbc.history).toHaveLength(1);
    expect(contractorCards(repo, { ...ALL, regions: ['SR1'] }).every((c) => c.contractor.subregion === 'SR1')).toBe(true);
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
  test('both regions, every quarter key', () => {
    const r = regionComparison(repo, ALL);
    expect(r.map((x) => x.region)).toEqual(['SR1', 'SR2']);
    r.forEach((x) => expect(Object.keys(x.byQuarter).sort()).toEqual(['Q1-2026', 'Q3-2026', 'Q4-2025']));
    expect(r[0].byQuarter['Q3-2026']).toBeNull(); // the July audit is SR2's
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
    const id = '4800001131'; // JV-ECH: audited in Q4 2025 and Q1 2026 (no Q3 audit)
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
  test('sanity: filterAudits unaffected', () => expect(filterAudits(repo, ALL)).toHaveLength(21));
});

describe('mainProblem', () => {
  test('filter all -> every audit, worst category overall, no comparison', () => {
    const m = mainProblem(repo, ALL)!;
    expect(m.quarter).toBe('all');
    const gaps = categoryGaps(repo, ALL);
    const worst = gaps.filter((g) => g.gapRate !== null).sort((a, b) => b.gapRate! - a.gapRate!)[0];
    expect(m.category).toBe(worst.category);
    expect(m.gapRate).toBeCloseTo(worst.gapRate!, 10);
    expect(m.prevGapRate).toBeNull();
    expect(m.items).toEqual(categoryDetail(repo, ALL, m.category).items.slice(0, 3));
  });
  test('a quarter -> that quarter against the previous one', () => {
    const f: Filter = { ...ALL, quarter: 'Q1-2026' };
    const m = mainProblem(repo, f)!;
    expect(m.quarter).toBe('Q1-2026');
    const q4 = categoryGaps(repo, { ...ALL, quarter: 'Q4-2025' }).find((g) => g.category === m.category)!;
    expect(m.prevGapRate).toBeCloseTo(q4.gapRate!, 10);
    expect(m.items.length).toBeLessThanOrEqual(3);
    expect(m.items).toEqual(categoryDetail(repo, f, m.category).items.slice(0, 3));
  });
  test('driving items are ranked by impact = audits with the finding x mean subsection score lost', () => {
    const m = mainProblem(repo, { ...ALL, quarter: 'Q1-2026' })!;
    const q1 = repo.audits().filter((a) => a.quarter === 'Q1-2026');
    for (const it of m.items) {
      const item = repo.checklist().find((i) => i.code === it.itemCode)!;
      const sub = item.subsection ?? item.section;
      // hits = audits in which the item is a finding (isFinding), not every audit with a note on it
      const hit = q1.filter((a) => repo.observations().some((o) => o.itemCode === it.itemCode && isFinding(a, o)));
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

describe('one findings rule everywhere (isFinding)', () => {
  test('main problem drivers count audits with the finding: Q1 2026 subcontractor B6.1–B6.3 in 9 of 11 audits', () => {
    const m = mainProblem(repo, { ...ALL, quarter: 'Q1-2026' })!;
    expect(m.category).toBe('subcontractor');
    expect(m.items.map((i) => [i.itemCode, i.hits])).toEqual([['B6.1', 9], ['B6.2', 9], ['B6.3', 9]]);
    expect(mainProblem(repo, ALL)!.items.map((i) => [i.itemCode, i.hits])).toEqual([['B6.1', 18], ['B6.4', 17], ['B6.5', 17]]);
    expect(filterAudits(repo, { ...ALL, quarter: 'Q1-2026' })).toHaveLength(11);
  });
  test('category findings, finding rates, item states and findingsByAudit agree', () => {
    const byAudit = findingsByAudit(repo, ALL);
    const codes = byAudit.reduce((n, r) => n + r.itemCodes.length, 0);
    const audits = new Set(byAudit.map((r) => r.audit.id));
    const site = repo.observations().filter((o) => o.kind === 'site' && audits.has(o.auditId)).length;
    expect(categoryGaps(repo, ALL).reduce((n, g) => n + g.findings, 0)).toBe(codes + site);
    expect(portfolioSummary(repo, ALL).negatives).toBe(codes + site);
    for (const { audit, itemCodes } of byAudit) {
      const noted = CATEGORIES.flatMap((c) => auditItemStates(repo, audit, c.id).filter((s) => s.state === 'noted').map((s) => s.item.code));
      expect(noted.sort()).toEqual([...itemCodes].sort());
    }
  });
  test('a note marked COMPLIANT is never counted', () => {
    const o = repo.observations().find((x) => x.marker === 'compliant' && x.itemCode)!;
    const audit = repo.audits().find((a) => a.id === o.auditId)!;
    const state = auditItemStates(repo, audit, repo.checklist().find((i) => i.code === o.itemCode)!.category)
      .find((s) => s.item.code === o.itemCode)!;
    expect(state.state === 'noted').toBe(findingsByAudit(repo, ALL).find((r) => r.audit.id === audit.id)!.itemCodes.includes(o.itemCode!));
  });
});
