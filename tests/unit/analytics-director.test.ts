import { describe, expect, test } from 'vitest';
import { getRepo, type Repo } from '@/lib/data/repo';
import { coverage, movers, regionComparison, regionDuel, weakestSection } from '@/lib/analytics';
import type { Audit, Filter } from '@/lib/types';

const repo = getRepo();
const ALL: Filter = { quarter: 'all', regions: ['SR1', 'SR2'] };
const r = (x: number | null) => (x === null ? null : Math.round(x * 100));

describe('regionDuel (SR1 vs SR2)', () => {
  test('All quarters speaks for the latest quarter: Q1 2026, SR1 65% vs SR2 72%, both up on Q4', () => {
    const d = regionDuel(repo, ALL)!;
    expect(d.quarter).toBe('Q1-2026');
    expect(d.previousQuarter).toBe('Q4-2025');
    expect(d.sides.map((s) => [s.region, r(s.score), r(s.previous), s.audits, s.contractors])).toEqual([
      ['SR1', 65, 64, 8, 8],
      ['SR2', 72, 70, 3, 3],
    ]);
    expect(d.audits).toBe(11);
    expect(r(d.portfolio)).toBe(67);
  });
  test('same averages as the /audits regions panel', () => {
    const d = regionDuel(repo, ALL)!;
    for (const row of regionComparison(repo, ALL)) {
      expect(d.sides.find((s) => s.region === row.region)!.score).toBeCloseTo(row.byQuarter['Q1-2026']!, 10);
    }
  });
  test('Q4 2025 has no quarter before it; one region filter gives one side', () => {
    const d = regionDuel(repo, { ...ALL, quarter: 'Q4-2025' })!;
    expect(d.previousQuarter).toBeNull();
    expect(d.sides.every((s) => s.previous === null)).toBe(true);
    expect(regionDuel(repo, { ...ALL, regions: ['SR2'] })!.sides.map((s) => s.region)).toEqual(['SR2']);
  });
  test('no audits → null', () => {
    expect(regionDuel(repo, { ...ALL, regions: [] })).toBeNull();
  });
});

describe('movers', () => {
  test('Q1 vs Q4: PPCO biggest rise (+14), Al Fahd (Coast Guard) biggest fall (−6)', () => {
    const m = movers(repo, ALL);
    expect(m.quarter).toBe('Q1-2026');
    expect([m.up[0].contractor.name, m.up[0].change]).toEqual(['PPCO', 14]);
    expect([m.down[0].contractor.name, m.down[0].change]).toEqual(['Al Fahd (Coast Guard)', -6]);
    expect(m.up.every((x, i) => i === 0 || x.change <= m.up[i - 1].change)).toBe(true);
    expect(m.down.every((x, i) => i === 0 || x.change >= m.down[i - 1].change)).toBe(true);
    expect(m.compared).toBe(7);
  });
  test('first quarter has nothing to compare', () => {
    const m = movers(repo, { ...ALL, quarter: 'Q4-2025' });
    expect([m.up, m.down, m.compared]).toEqual([[], [], 0]);
  });
});

describe('coverage (audits done)', () => {
  test('Q1 2026: 8 of 9 SR1 contractors (Al-Biriki waiting), 3 of 3 SR2', () => {
    const c = coverage(repo, ALL);
    expect(c.quarter).toBe('Q1-2026');
    expect(c.regions.map((x) => [x.region, x.audits, x.audited, x.contractors, x.missing.map((m) => m.name)])).toEqual([
      ['SR1', 8, 8, 9, ['Al-Biriki']],
      ['SR2', 3, 3, 3, []],
    ]);
  });
});

describe('typed dashboards (Security, Environmental, Welfare, CRC)', () => {
  test('seed has no typed audits: every director tile is empty for a non-H&S tab', () => {
    const f: Filter = { ...ALL, type: 'security' };
    expect(regionDuel(repo, f)).toBeNull();
    expect(movers(repo, f).compared).toBe(0);
    expect(weakestSection(repo, f)).toBeNull();
  });

  // A Security fixture: two contractors, one per region, audited in both quarters.
  const sec = (id: string, contractorId: string, quarter: Audit['quarter'], total: number, cctv: number): Audit => ({
    id, type: 'security', contractorId, quarter, date: quarter === 'Q4-2025' ? '2025-12-01' : '2026-03-01',
    location: 'x', inspectionNo: id, auditors: [], totalScore: total,
    sections: [
      { code: 'A', label: 'Documentation', possible: 10, scored: 9 },
      { code: 'D', label: 'CCTV', possible: 10, scored: cctv },
      { code: 'Q', label: 'Mass Notification', possible: 0, scored: 0 },
    ],
  });
  const fixture: Repo = {
    ...repo,
    audits: () => [
      ...repo.audits(),
      sec('s1', '4800001131', 'Q4-2025', 0.7, 6), sec('s2', '4800001131', 'Q1-2026', 0.8, 5),
      sec('s3', '4800001112', 'Q4-2025', 0.6, 4), sec('s4', '4800001112', 'Q1-2026', 0.55, 3),
    ],
  };
  const f: Filter = { ...ALL, type: 'security' };

  test('typed audits never mix into H&S, and H&S never into Security', () => {
    expect(regionDuel(fixture, ALL)!.audits).toBe(11);
    expect(regionDuel(fixture, f)!.audits).toBe(2);
  });
  test('weakest section = lowest mean scored/possible, N/A sections skipped, with the quarter before', () => {
    expect(weakestSection(fixture, f)).toEqual({ quarter: 'Q1-2026', code: 'D', label: 'CCTV', score: 0.4, previous: 0.5, audits: 2 });
  });
  test('movers and coverage work for the type', () => {
    const m = movers(fixture, f);
    expect(m.up.map((x) => x.change)).toEqual([10]);
    expect(m.down.map((x) => x.change)).toEqual([-5]);
    expect(coverage(fixture, f).regions.map((x) => [x.region, x.audited, x.contractors])).toEqual([['SR1', 1, 1], ['SR2', 1, 1]]);
  });
});
