import { describe, expect, test } from 'vitest';
import { getRepo } from '@/lib/data/repo';
import { filterAudits, highRiskByContractor, highRiskByHazard, highRiskCount } from '@/lib/analytics';
import { HAZARDS, HIGH_RISK_KEYWORDS, hazardOf, rankHighRisk, type HighRiskContractor } from '@/lib/highRisk';
import type { Filter, Observation } from '@/lib/types';

const repo = getRepo();
const ALL: Filter = { quarter: 'all', regions: ['SR1', 'SR2'] };
const obs = (o: Partial<Observation>): Observation => ({ id: 'x', auditId: 'a', itemCode: null, kind: 'site', text: '', category: null, hasPhoto: false, ...o });

describe('hazardOf', () => {
  test('keyword first: a permit / utility item naming a hazard goes to that hazard', () => {
    expect(hazardOf(obs({ kind: 'negative', itemCode: 'B4.2', text: 'No hot work permit' }))).toBe('hotwork');
    expect(hazardOf(obs({ kind: 'negative', itemCode: 'B5.1', text: 'Excavation without utility clearance' }))).toBe('excavation');
    expect(hazardOf(obs({ kind: 'negative', itemCode: 'B4.1', text: 'Lifting plan missing for the crane' }))).toBe('lifting');
  });
  test('a permit / utility item naming no hazard is permits & utility clearance', () => {
    expect(hazardOf(obs({ kind: 'negative', itemCode: 'B4.1', text: 'Permit to work not displayed' }))).toBe('permits');
    expect(hazardOf(obs({ kind: 'negative', itemCode: 'B5.3', text: 'Clearance form unsigned' }))).toBe('permits');
  });
  test('site findings go to the keyword family that appears first', () => {
    expect(hazardOf(obs({ text: 'Mobile crane lifting near the trench' }))).toBe('lifting');
    expect(hazardOf(obs({ text: 'Scaffolding not tagged' }))).toBe('height');
    expect(hazardOf(obs({ text: 'Harness not hooked, near an electrical panel' }))).toBe('height');
    expect(hazardOf(obs({ text: 'Electrical cables across the excavation' }))).toBe('electrical');
    expect(hazardOf(obs({ text: 'Tower light not earthed (no earthing)' }))).toBe('electrical');
    expect(hazardOf(obs({ text: 'Boulders at the edge of the excavation' }))).toBe('excavation');
    expect(hazardOf(obs({ text: 'Confined space entry with no gas test' }))).toBe('confined');
    expect(hazardOf(obs({ text: 'LPG and gas cylinders stored in the sun' }))).toBe('hotwork');
    expect(hazardOf(obs({ text: 'Housekeeping poor' }))).toBe('other');
  });
  test('the keyword families cover every high-risk keyword', () => {
    const words = HIGH_RISK_KEYWORDS.source.replace(/^\\b\(|\)$/g, '').split('|');
    for (const w of words) expect(HAZARDS.some((h) => h.keywords?.test(w))).toBe(true);
  });
});

describe('highRiskByHazard', () => {
  test('filter all: every finding in exactly one bucket; counts sum to highRiskCount (127)', () => {
    const rows = highRiskByHazard(repo, ALL);
    expect(highRiskCount(repo, ALL)).toBe(127);
    expect(rows.map((r) => r.hazard)).toEqual(HAZARDS.map((h) => h.id));
    expect(rows.reduce((s, r) => s + r.count, 0)).toBe(127);
    expect(rows.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1, 9);
    // keyword first: permits holds only permit / utility items that name no hazard
    expect(Object.fromEntries(rows.map((r) => [r.hazard, r.count]))).toEqual({
      lifting: 9, height: 18, electrical: 28, excavation: 34, confined: 2, hotwork: 14, permits: 22, other: 0,
    });
  });
  test('sums hold under quarter and region filters', () => {
    for (const f of [{ ...ALL, quarter: 'Q4-2025' }, { ...ALL, quarter: 'Q1-2026' }, { ...ALL, regions: ['SR2'] }] as Filter[]) {
      expect(highRiskByHazard(repo, f).reduce((s, r) => s + r.count, 0)).toBe(highRiskCount(repo, f));
    }
  });
  test('non-H&S type or no regions: all zero, shares 0 (no NaN)', () => {
    for (const f of [{ ...ALL, type: 'security' }, { ...ALL, regions: [] }] as Filter[]) {
      for (const r of highRiskByHazard(repo, f)) {
        expect(r.count).toBe(0);
        expect(r.share).toBe(0);
      }
    }
  });
});

describe('highRiskByContractor', () => {
  const rows = highRiskByContractor(repo, ALL);
  test('one row per audited contractor; findings and audits add up', () => {
    const audits = filterAudits(repo, ALL);
    expect(rows).toHaveLength(new Set(audits.map((a) => a.contractorId)).size);
    expect(rows.flatMap((r) => r.quarters).reduce((s, q) => s + q.audits, 0)).toBe(audits.length);
    expect(rows.flatMap((r) => r.quarters).reduce((s, q) => s + q.findings, 0)).toBe(127);
    for (const q of rows.flatMap((r) => r.quarters)) expect(Object.values(q.byHazard).reduce((s, n) => s + n, 0)).toBe(q.findings);
  });
  test('Q4 only: one quarter per contractor', () => {
    for (const r of highRiskByContractor(repo, { ...ALL, quarter: 'Q4-2025' })) expect(r.quarters.map((q) => q.quarter)).toEqual(['Q4-2025']);
  });
  test('non-H&S type: none', () => {
    expect(highRiskByContractor(repo, { ...ALL, type: 'security' })).toEqual([]);
  });
});

describe('rankHighRisk', () => {
  const rows: HighRiskContractor[] = [
    { id: '1', name: 'Bravo', quarters: [{ quarter: 'Q4-2025', audits: 1, findings: 2, byHazard: { excavation: 2 } }, { quarter: 'Q1-2026', audits: 2, findings: 6, byHazard: { excavation: 1, lifting: 5 } }] },
    { id: '2', name: 'Alpha', quarters: [{ quarter: 'Q4-2025', audits: 2, findings: 10, byHazard: { excavation: 10 } }] },
    { id: '3', name: 'Charlie', quarters: [{ quarter: 'Q1-2026', audits: 1, findings: 0, byHazard: {} }] },
  ];
  test('worst first by latest-quarter findings per audit, with the quarter before as past', () => {
    expect(rankHighRisk(rows)).toEqual([
      { id: '2', name: 'Alpha', now: 5, nowQuarter: 'Q4-2025', past: null, findings: 10 },
      { id: '1', name: 'Bravo', now: 3, nowQuarter: 'Q1-2026', past: 2, findings: 8 },
      { id: '3', name: 'Charlie', now: 0, nowQuarter: 'Q1-2026', past: null, findings: 0 },
    ]);
  });
  test('one hazard: rates and order from that hazard only', () => {
    const r = rankHighRisk(rows, 'lifting');
    expect(r.map((x) => [x.id, x.now, x.past])).toEqual([['1', 2.5, 0], ['2', 0, null], ['3', 0, null]]);
  });
  test('real data: per-audit rates are finite, sorted worst first', () => {
    const r = rankHighRisk(highRiskByContractor(repo, ALL));
    expect(r).toHaveLength(12);
    for (const x of r) expect(Number.isFinite(x.now) && (x.past === null || Number.isFinite(x.past))).toBe(true);
    for (let i = 1; i < r.length; i++) expect(r[i - 1].now).toBeGreaterThanOrEqual(r[i].now);
  });
});
