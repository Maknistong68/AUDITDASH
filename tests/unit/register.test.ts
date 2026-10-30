import { describe, expect, test } from 'vitest';
import { getRepo, type Repo } from '@/lib/data/repo';
import { contractorCards, filterAudits, portfolioSummary, quarterLines, regionHistory, regionPath } from '@/lib/analytics';
import { REGIONS } from '@/lib/filters';
import { contractorForProject, subregionFor } from '@/lib/input/contractors';
import type { Audit, Contractor, Filter } from '@/lib/types';

const ALL: Filter = { quarter: 'all', regions: ['SR1', 'SR2'] };

/** A contractor moved from SR1 (Q4 2025) to SR2 (Q1 2026), another one deactivated in the register. */
const audit = (id: string, contractorId: string, subregion: Audit['subregion'], quarter: Audit['quarter'], date: string, total: number): Audit => ({
  id, contractorId, subregion, quarter, date, location: '', inspectionNo: '', auditors: [], totalScore: total,
  sections: [{ code: 'A', label: 'A', possible: 10, scored: total * 10 }],
});
const c = (id: string, subregion: Contractor['subregion'], active = true): Contractor => ({ id, name: id.toUpperCase(), contractNo: id, subregion, active, aliases: [] });
const moved: Repo = {
  checklist: () => [],
  contractors: () => [c('m', 'SR2'), c('s', 'SR1'), c('off', 'SR1', false)],
  audits: () => [
    audit('m-q4', 'm', 'SR1', 'Q4-2025', '2025-11-01', 0.6),
    audit('m-q1', 'm', 'SR2', 'Q1-2026', '2026-02-01', 0.7),
    audit('s-q4', 's', 'SR1', 'Q4-2025', '2025-11-02', 0.5),
    audit('s-q1', 's', 'SR1', 'Q1-2026', '2026-02-02', 0.55),
    audit('off-q4', 'off', 'SR1', 'Q4-2025', '2025-11-03', 0.4),
  ],
  observations: () => [],
};

describe('sub-region belongs to each audit (its sheet in the Excel)', () => {
  test('a moved contractor counts in SR1 for Q4 and in SR2 for Q1', () => {
    expect(filterAudits(moved, { ...ALL, regions: ['SR1'] }).map((a) => a.id)).toEqual(['m-q4', 's-q4', 'off-q4', 's-q1']);
    expect(filterAudits(moved, { ...ALL, regions: ['SR2'] }).map((a) => a.id)).toEqual(['m-q1']);
    expect(portfolioSummary(moved, { quarter: 'Q1-2026', regions: ['SR2'] }).avgScore).toBeCloseTo(0.7, 10);
  });
  test('its history reads SR1 → SR2; its line stays one line across the move', () => {
    expect(regionHistory(moved, 'm')).toEqual([{ quarter: 'Q4-2025', regions: ['SR1'] }, { quarter: 'Q1-2026', regions: ['SR2'] }]);
    expect(regionPath(moved, 'm')).toBe('SR1 → SR2');
    expect(regionPath(moved, 's')).toBe('SR1');
    expect(quarterLines(moved, ALL).lines.find((l) => l.id === 'm')!.values).toEqual([0.6, 0.7]);
  });
  test('the SR2 ranking shows the moved contractor with its SR2 audit only', () => {
    const cards = contractorCards(moved, { ...ALL, regions: ['SR2'] });
    expect(cards.map((x) => x.contractor.id)).toEqual(['m']);
    expect(cards[0].total).toBe(0.7);
  });
});

describe('register status', () => {
  test('an inactive contractor is off the ranking but its audits stay in every total', () => {
    expect(contractorCards(moved, ALL).map((x) => x.contractor.id)).not.toContain('off');
    expect(filterAudits(moved, ALL).some((a) => a.contractorId === 'off')).toBe(true);
    expect(portfolioSummary(moved, { quarter: 'Q4-2025', regions: ['SR1', 'SR2'] }).audits).toBe(3);
  });
});

describe('the seed', () => {
  const repo = getRepo();
  test('every audit carries the sub-region of its sheet; regions come from the data', () => {
    expect(REGIONS).toEqual(['SR1', 'SR2']);
    for (const a of repo.audits()) expect(REGIONS).toContain(a.subregion);
    for (const ct of repo.contractors()) {
      const last = repo.audits().filter((a) => a.contractorId === ct.id).sort((x, y) => x.date.localeCompare(y.date)).at(-1);
      expect(ct.subregion).toBe(last?.subregion ?? null);
      expect(ct.active).toBe(true);
    }
  });
  test('project names and contract numbers find the contractor; a location names the sub-region', () => {
    expect(contractorForProject('SIBS - 4800000838')).toBe('4800000838');
    expect(contractorForProject('AL FAHD-4800001272')).toBe('4800001272');
    expect(contractorForProject('New name for 4800001440 works')).toBe('4800001440');
    expect(contractorForProject('Somebody else')).toBeNull();
    expect(subregionFor('Sub Region 2 - Coast Guard Facilities', null)).toBe('SR2');
    expect(subregionFor('Zone F', '4800001112')).toBe('SR1');
  });
});
