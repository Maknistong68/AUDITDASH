import { describe, expect, test } from 'vitest';
import { getRepo } from '../../lib/data/repo';
import { bandDistribution, filterAudits } from '../../lib/analytics';
import { BAND_SLUGS, monthTicks, parseBand, rowsInBand, splitName, timeDomain, timelineRows, trend, xOf } from '../../lib/timeline';
import type { Band, Contractor } from '../../lib/types';

const ALL = { quarter: 'all' as const, regions: ['SR1', 'SR2'] as ('SR1' | 'SR2')[] };
const repo = getRepo();

describe('timelineRows', () => {
  const rows = timelineRows(filterAudits(repo, ALL), repo.contractors());

  test('filter all: 12 contractors, 20 audits, worst latest score first', () => {
    expect(rows).toHaveLength(12);
    expect(rows.reduce((s, r) => s + r.audits.length, 0)).toBe(20);
    const latest = rows.map((r) => r.latest);
    expect(latest).toEqual([...latest].sort((a, b) => a - b));
    expect(rows.at(-1)!.name).toBe('JV-ECH (Port T1)');
  });

  test('audits in date order, one trend per consecutive pair, by whole points', () => {
    for (const r of rows) {
      expect(r.audits.map((a) => a.date)).toEqual([...r.audits.map((a) => a.date)].sort());
      expect(r.trends).toHaveLength(r.audits.length - 1);
      r.trends.forEach((t, k) => expect(t).toBe(trend(r.audits[k].score, r.audits[k + 1].score)));
    }
    const sibs = rows.find((r) => r.name === 'SIBS')!;
    expect(sibs.audits).toHaveLength(3);
    expect(sibs.trends).toEqual(['up', 'up']);
    expect(rows.find((r) => r.name === 'Al Fahd (Coast Guard)')!.trends).toEqual(['down']); // 74 → 59
  });

  test('the latest band matches the dashboard band counts', () => {
    const counts = bandDistribution(repo, ALL);
    for (const b of Object.keys(BAND_SLUGS) as Band[]) expect(rowsInBand(rows, b)).toHaveLength(counts[b]);
    expect(rowsInBand(rows, null)).toHaveLength(12);
  });

  test('ties break by name; unknown contractors and non-finite scores are left out', () => {
    const cs: Contractor[] = [
      { id: 'b', name: 'Beta', contractNo: '', subregion: 'SR1' },
      { id: 'a', name: 'Alpha', contractNo: '', subregion: 'SR2' },
    ];
    const out = timelineRows(
      [
        { id: '1', contractorId: 'b', date: '2025-10-02', totalScore: 0.7, quarter: 'Q4-2025' },
        { id: '2', contractorId: 'a', date: '2025-10-03', totalScore: 0.7, quarter: 'Q4-2025' },
        { id: '3', contractorId: 'zz', date: '2025-10-03', totalScore: 0.5, quarter: 'Q4-2025' },
        { id: '4', contractorId: 'a', date: '2026-01-03', totalScore: NaN, quarter: 'Q1-2026' },
      ],
      cs,
    );
    expect(out.map((r) => r.name)).toEqual(['Alpha', 'Beta']);
    expect(out[0].audits).toHaveLength(1);
    expect(timelineRows([], cs)).toEqual([]);
  });
});

test('trend compares displayed whole points', () => {
  expect(trend(0.62, 0.65)).toBe('up');
  expect(trend(0.71, 0.65)).toBe('down');
  expect(trend(0.664, 0.661)).toBe('flat');
});

describe('time axis', () => {
  test('two quarters: Q4 is the left half, Q1 the right; dates land inside their quarter', () => {
    const d = timeDomain(['Q4-2025', 'Q1-2026']);
    expect(d.quarters.map((q) => q.quarter)).toEqual(['Q4-2025', 'Q1-2026']);
    expect(d.quarters[0].from).toBe(0);
    expect(d.quarters[1].to).toBe(1);
    expect(d.quarters[0].to).toBeCloseTo(d.quarters[1].from);
    const split = d.quarters[0].to;
    expect(xOf('2025-10-13', d)).toBeLessThan(split);
    expect(xOf('2025-12-31', d)).toBeLessThan(split);
    expect(xOf('2026-01-01', d)).toBeGreaterThan(split);
    expect(xOf('2025-11-12', d)).toBeLessThan(xOf('2025-11-19', d));
    expect(monthTicks(d).map((m) => m.label)).toEqual(['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']);
  });

  test('month breaks tile the axis: each month ends where the next starts; the quarter split is a month break', () => {
    const d = timeDomain(['Q4-2025', 'Q1-2026']);
    const ms = monthTicks(d);
    expect(ms[0].from).toBe(0);
    expect(ms.at(-1)!.to).toBe(1);
    for (let i = 1; i < ms.length; i++) expect(ms[i].from).toBeCloseTo(ms[i - 1].to, 12);
    for (const m of ms) expect(m.x).toBeCloseTo((m.from + m.to) / 2, 12);
    expect(ms.find((m) => m.label === 'Jan')!.from).toBeCloseTo(d.quarters[0].to, 12);
    expect(ms.map((m) => m.month)).toEqual([9, 10, 11, 0, 1, 2]);
    expect(xOf('2025-11-30', d)).toBeLessThan(ms[2].from);
    expect(xOf('2025-12-01', d)).toBeGreaterThan(ms[2].from);
  });

  test('one quarter spans the whole axis; bad dates never give NaN', () => {
    const d = timeDomain(['Q4-2025']);
    expect(d.quarters).toEqual([{ quarter: 'Q4-2025', from: 0, to: 1 }]);
    expect(monthTicks(d).map((m) => m.label)).toEqual(['Oct', 'Nov', 'Dec']);
    for (const a of filterAudits(repo, { ...ALL, quarter: 'Q4-2025' })) {
      const x = xOf(a.date, d);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(1);
    }
    expect(xOf('not a date', d)).toBe(0);
    expect(xOf('2027-01-01', d)).toBe(1);
    expect(Number.isNaN(xOf('2025-10-01', timeDomain([])))).toBe(false);
  });
});

test('band slugs round-trip; unknown → null', () => {
  for (const [band, slug] of Object.entries(BAND_SLUGS)) expect(parseBand(slug)).toBe(band);
  expect(parseBand('x')).toBeNull();
  expect(parseBand(null)).toBeNull();
});

test('splitName', () => {
  expect(splitName('Abyatona (Box Culvert H55)')).toEqual({ base: 'Abyatona', qual: 'Box Culvert H55' });
  expect(splitName('PPCO')).toEqual({ base: 'PPCO', qual: '' });
});
