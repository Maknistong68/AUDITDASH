import { describe, expect, test } from 'vitest';
import { getRepo, type Repo } from '@/lib/data/repo';
import {
  compareContractors, contractorCards, findingsByAudit, followUps, isFinding, repeatContractors, repeatFindings, repeatMatrix,
  repeatQuestions, subsectionOf,
} from '@/lib/analytics';
import fixture from './fixtures/abyatona-1112-responses.json';
import type { Filter } from '@/lib/types';

const repo = getRepo();
const ALL: Filter = { quarter: 'all', regions: ['SR1', 'SR2'] };
const NONE: Filter = { quarter: 'all', regions: [] };
const SIBS = '4800000838'; // audited 2025-11-12 and 2025-11-19 (both Q4) and 2026-02-01
const TDP = '4800000892'; // a single audit: nothing to repeat

const audit = (id: string) => repo.audits().find((a) => a.id === id)!;
/** Findings of one audit (the rule's input), straight from the seed. */
const noted = (auditId: string) =>
  new Set(repo.observations().filter((o) => isFinding(audit(auditId), o)).map((o) => o.itemCode!));
const ABYATONA_Q4 = '4800001112-Q4-2025-20251015';
const NBC_Q1 = '4200000026-Q1-2026-20260208';

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
    expect(repeatFindings(repo, ALL)).toHaveLength(291);
    expect(repeatFindings(repo, { ...ALL, quarter: 'Q1-2026' })).toHaveLength(228);
    expect(repeatFindings(repo, { ...ALL, quarter: 'Q4-2025' })).toHaveLength(63);
    expect(repeatFindings(repo, { ...ALL, regions: ['SR1'] })).toHaveLength(217);
    expect(repeatFindings(repo, { ...ALL, regions: ['SR2'] })).toHaveLength(74);
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
  test('contractors with a follow-up audit', () => {
    expect(repeatContractors(repo, ALL)).toHaveLength(7);
  });
});

describe('compareContractors repeats', () => {
  test('the latest audit\'s repeats only', () => {
    const [x] = compareContractors(repo, ALL, [SIBS]);
    expect(x.repeats.length).toBeGreaterThan(0);
    expect(new Set(x.repeats.map((r) => r.auditId))).toEqual(new Set([x.card.auditId]));
  });
});

describe('isFinding: the interim finding rule (auditor note, no COMPLIANT / N/A marker, section lost points)', () => {
  test('ABYATONA-1112 Q4: the findings are exactly its Part 1 Partial / No answers', () => {
    const partOne = Object.entries(fixture).filter(([, v]) => v === 'partial' || v === 'no').map(([k]) => k).sort();
    expect([...noted(ABYATONA_Q4)].sort()).toEqual(partOne);
    expect(partOne).toHaveLength(50);
  });
  test('NBC Q1: notes marked COMPLIANT or N/A in the evidence column are not findings', () => {
    const marked = repo.observations().filter((o) => o.auditId === NBC_Q1 && o.marker);
    expect(marked.filter((o) => o.marker === 'compliant').length).toBeGreaterThanOrEqual(10);
    for (const o of marked) expect(isFinding(audit(NBC_Q1), o)).toBe(false);
    // the same notes without the marker would be findings where their section lost points
    const unmarked = marked.map((o) => ({ ...o, marker: null }));
    expect(unmarked.some((o) => isFinding(audit(NBC_Q1), o))).toBe(true);
  });
  test('an item in a subsection scored 100% is never a finding', () => {
    let checked = 0;
    for (const a of repo.audits()) {
      const full = new Set(a.sections.filter((s) => s.possible > 0 && s.scored >= s.possible).map((s) => s.code));
      for (const o of repo.observations()) {
        if (o.auditId !== a.id || !o.itemCode || !full.has(subsectionOf(o.itemCode))) continue;
        checked++;
        expect(isFinding(a, o)).toBe(false);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
  test('needs a negative item note with text, in its own audit', () => {
    const a = audit(ABYATONA_Q4);
    const o = repo.observations().find((x) => isFinding(a, x))!;
    expect(isFinding(a, { ...o, kind: 'positive' })).toBe(false);
    expect(isFinding(a, { ...o, itemCode: null })).toBe(false);
    expect(isFinding(a, { ...o, text: '  ' })).toBe(false);
    expect(isFinding(a, { ...o, marker: 'na' })).toBe(false);
    expect(isFinding(audit(NBC_Q1), o)).toBe(false);
  });
  test('subsectionOf matches the checklist', () => {
    for (const i of repo.checklist()) expect(subsectionOf(i.code)).toBe(i.subsection ?? i.section);
  });
  test('findingsByAudit: distinct codes per audit, all findings', () => {
    const rows = findingsByAudit(repo, ALL);
    expect(rows).toHaveLength(20);
    for (const r of rows) {
      expect(new Set(r.itemCodes).size).toBe(r.itemCodes.length);
      expect(new Set(r.itemCodes)).toEqual(noted(r.audit.id));
    }
    expect(findingsByAudit(repo, NONE)).toEqual([]);
  });
});

describe('repeatMatrix: questions × contractors, times repeated', () => {
  const m = repeatMatrix(repo, ALL);
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  test('totals equal the sum of the cells, and the repeat count', () => {
    for (const q of m.questions) expect(q.total).toBe(sum(m.contractors.map((c) => m.cells[c.id]?.[q.itemCode] ?? 0)));
    for (const c of m.contractors) expect(c.total).toBe(sum(Object.values(m.cells[c.id] ?? {})));
    expect(sum(m.questions.map((q) => q.total))).toBe(repeatFindings(repo, ALL).length);
    expect(sum(m.contractors.map((c) => c.total))).toBe(repeatFindings(repo, ALL).length);
    expect(m.contractors).toHaveLength(repeatContractors(repo, ALL).length);
  });
  test('SIBS (three audits) repeats a question in both of its follow-ups', () => {
    expect(Math.max(...Object.values(m.cells[SIBS]))).toBeGreaterThanOrEqual(2);
    expect(Object.entries(m.cells).every(([id, row]) => id === SIBS || Object.values(row).every((n) => n === 1))).toBe(true);
  });
  test('sorted: questions by total, category, code; contractors by total', () => {
    for (let i = 1; i < m.questions.length; i++) expect(m.questions[i - 1].total).toBeGreaterThanOrEqual(m.questions[i].total);
    for (let i = 1; i < m.contractors.length; i++) expect(m.contractors[i - 1].total).toBeGreaterThanOrEqual(m.contractors[i].total);
    expect(m.questions.every((q) => q.label && !/^[ABC]\d/.test(q.label))).toBe(true);
  });
  test('empty and Q4-only filters: no NaN, consistent', () => {
    expect(repeatMatrix(repo, NONE)).toEqual({ questions: [], contractors: [], cells: {} });
    const q4 = repeatMatrix(repo, { ...ALL, quarter: 'Q4-2025' });
    expect(q4.contractors.map((c) => c.id)).toEqual([SIBS]);
    const nums = [...q4.questions.map((q) => q.total), ...q4.contractors.map((c) => c.total), ...Object.values(q4.cells).flatMap((r) => Object.values(r))];
    expect(nums.every((n) => Number.isFinite(n) && n > 0)).toBe(true);
    expect(sum(q4.questions.map((q) => q.total))).toBe(repeatFindings(repo, { ...ALL, quarter: 'Q4-2025' }).length);
  });
});
