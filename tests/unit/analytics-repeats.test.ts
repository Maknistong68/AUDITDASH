import { describe, expect, test } from 'vitest';
import { getRepo, type Repo } from '@/lib/data/repo';
import {
  compareContractors, contractorCards, followUps, repeatContractors, repeatFindings, repeatQuestions, repeatSpread,
} from '@/lib/analytics';
import type { Filter } from '@/lib/types';

const repo = getRepo();
const ALL: Filter = { quarter: 'all', regions: ['SR1', 'SR2'] };
const NONE: Filter = { quarter: 'all', regions: [] };
const SIBS = '4800000838'; // audited 2025-11-12 and 2025-11-19 (both Q4) and 2026-02-01
const TDP = '4800000892'; // a single audit: nothing to repeat

/** Applicable item notes of one audit (the rule's input), straight from the seed. */
const noted = (auditId: string) =>
  new Set(repo.observations().filter((o) => o.auditId === auditId && o.kind === 'negative' && o.itemCode).map((o) => o.itemCode!));

describe('followUps: each audit paired with the same contractor\'s audit before it', () => {
  test('8 pairs over all quarters; the later audit sets the quarter', () => {
    expect(followUps(repo, ALL)).toHaveLength(8);
    expect(followUps(repo, { ...ALL, quarter: 'Q1-2026' })).toHaveLength(7);
    const q4 = followUps(repo, { ...ALL, quarter: 'Q4-2025' });
    expect(q4.map((p) => [p.contractor.id, p.prev.date, p.next.date])).toEqual([[SIBS, '2025-11-12', '2025-11-19']]);
  });
  test('consecutive, same contractor, earlier date first', () => {
    for (const p of followUps(repo, ALL)) {
      expect(p.prev.contractorId).toBe(p.contractor.id);
      expect(p.next.contractorId).toBe(p.contractor.id);
      expect(p.prev.date < p.next.date).toBe(true);
      const between = repo.audits().filter((a) => a.contractorId === p.contractor.id && a.date > p.prev.date && a.date < p.next.date);
      expect(between).toEqual([]);
    }
  });
  test('regions respected; empty filter and other audit types have none', () => {
    expect(followUps(repo, { ...ALL, regions: ['SR1'] })).toHaveLength(5);
    expect(followUps(repo, { ...ALL, regions: ['SR2'] })).toHaveLength(3);
    expect(followUps(repo, NONE)).toEqual([]);
    expect(followUps(repo, { ...ALL, type: 'security' })).toEqual([]);
  });
});

describe('repeatFindings: the same question noted again at the next audit', () => {
  test('seed totals per filter', () => {
    expect(repeatFindings(repo, ALL)).toHaveLength(345);
    expect(repeatFindings(repo, { ...ALL, quarter: 'Q1-2026' })).toHaveLength(268);
    expect(repeatFindings(repo, { ...ALL, quarter: 'Q4-2025' })).toHaveLength(77);
    expect(repeatFindings(repo, { ...ALL, regions: ['SR1'] })).toHaveLength(250);
    expect(repeatFindings(repo, { ...ALL, regions: ['SR2'] })).toHaveLength(95);
    expect(repeatFindings(repo, NONE)).toEqual([]);
  });
  test('every row is noted in both audits of its pair; every such question is a row', () => {
    const rows = repeatFindings(repo, ALL);
    for (const p of followUps(repo, ALL)) {
      const before = noted(p.prev.id);
      const both = [...noted(p.next.id)].filter((c) => before.has(c)).sort();
      const mine = rows.filter((r) => r.auditId === p.next.id).map((r) => r.itemCode).sort();
      expect(mine).toEqual(both);
      for (const r of rows.filter((x) => x.auditId === p.next.id)) expect(r.prevAuditId).toBe(p.prev.id);
    }
  });
  test('a same-quarter follow-up counts (SIBS, Q4 → Q4)', () => {
    const q4 = repeatFindings(repo, { ...ALL, quarter: 'Q4-2025' });
    expect(new Set(q4.map((r) => r.contractor.id))).toEqual(new Set([SIBS]));
  });
  test('a contractor audited once never repeats', () => {
    expect(repeatFindings(repo, ALL).some((r) => r.contractor.id === TDP)).toBe(false);
  });
  test('worst contractor (lowest latest total) first', () => {
    const totals = new Map(contractorCards(repo, ALL).map((c) => [c.contractor.id, c.total]));
    const t = repeatFindings(repo, ALL).map((x) => totals.get(x.contractor.id)!);
    expect(t).toEqual([...t].sort((a, b) => a - b));
  });
  test('notes on an N/A subsection never count', () => {
    // TDP's audit scores B5 N/A; give TDP a fake earlier audit and the same B5 note in both: still no repeat.
    const tdp = repo.audits().find((a) => a.contractorId === TDP)!;
    const earlier = { ...tdp, id: `${tdp.id}-prev`, date: '2026-01-01', sections: tdp.sections };
    const note = (auditId: string) => ({ id: `${auditId}-b5`, auditId, itemCode: 'B5.1', kind: 'negative' as const, text: 'x', category: 'documents' as const, hasPhoto: false });
    const r: Repo = { ...repo, audits: () => [...repo.audits(), earlier], observations: () => [...repo.observations(), note(tdp.id), note(earlier.id)] };
    expect(tdp.sections.find((s) => s.code === 'B5')!.possible).toBe(0);
    expect(repeatFindings(r, { ...ALL, contractorId: TDP }).some((x) => x.itemCode === 'B5.1')).toBe(false);
  });
});

describe('repeatQuestions', () => {
  const rows = repeatQuestions(repo, ALL);
  test('one row per repeated question; times and contractors add up', () => {
    const findings = repeatFindings(repo, ALL);
    expect(rows).toHaveLength(new Set(findings.map((f) => f.itemCode)).size);
    expect(rows.reduce((s, r) => s + r.times, 0)).toBe(findings.length);
    for (const r of rows) {
      expect(r.contractors).toHaveLength(r.contractorCount);
      expect(r.sectionScores.map((x) => x.contractorId)).toEqual(r.contractors.map((c) => c.id));
      expect(r.times).toBeGreaterThanOrEqual(r.contractorCount);
    }
  });
  test('widest reach first, then most repeated', () => {
    for (let i = 1; i < rows.length; i++) {
      const [a, b] = [rows[i - 1], rows[i]];
      expect(a.contractorCount).toBeGreaterThanOrEqual(b.contractorCount);
      if (a.contractorCount === b.contractorCount) expect(a.times).toBeGreaterThanOrEqual(b.times);
    }
  });
  test('repeatSpread covers every question; reach is out of the contractors with a follow-up', () => {
    const of = repeatContractors(repo, ALL).length;
    expect(of).toBe(7);
    const spread = repeatSpread(rows, of);
    expect(spread.reduce((s, x) => s + x.questions, 0)).toBe(rows.length);
    expect(spread.every((x) => x.of === of && x.reach <= of)).toBe(true);
  });
});

describe('compareContractors repeats', () => {
  test('the latest audit\'s repeats only', () => {
    const [x] = compareContractors(repo, ALL, [SIBS]);
    expect(x.repeats.length).toBeGreaterThan(0);
    expect(new Set(x.repeats.map((r) => r.auditId))).toEqual(new Set([x.card.auditId]));
  });
});
