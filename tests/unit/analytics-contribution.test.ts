import { describe, expect, test } from 'vitest';
import { getRepo, type Repo } from '@/lib/data/repo';
import { categoryGaps, gapContribution, mainProblem } from '@/lib/analytics';
import type { Audit, ChecklistItem, Filter } from '@/lib/types';

const repo = getRepo();
const ALL: Filter = { quarter: 'all', regions: ['SR1', 'SR2'] };
const NONE: Filter = { quarter: 'all', regions: [] };

describe('gapContribution', () => {
  test('shares sum to 1, none NaN, each in [0, 1]', () => {
    for (const quarter of ['all', 'Q4-2025', 'Q1-2026'] as const) {
      for (const regions of [['SR1', 'SR2'], ['SR1'], ['SR2']] as Filter['regions'][]) {
        const rows = gapContribution(repo, { quarter, regions });
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1, 9);
        for (const r of rows) {
          expect(Number.isFinite(r.share) && Number.isFinite(r.gapRate)).toBe(true);
          expect(r.share).toBeGreaterThanOrEqual(0);
          expect(r.share).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  test('sorted by share desc, then gapRate desc; one row per category', () => {
    const rows = gapContribution(repo, ALL);
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1];
      const b = rows[i];
      expect(a.share > b.share || (a.share === b.share && a.gapRate >= b.gapRate)).toBe(true);
    }
    expect(new Set(rows.map((r) => r.category)).size).toBe(rows.length);
  });

  test('uses the same (latest) quarter and gapRate as mainProblem / categoryGaps', () => {
    const m = mainProblem(repo, ALL)!;
    expect(m.quarter).toBe('Q1-2026');
    const q1 = categoryGaps(repo, { ...ALL, quarter: 'Q1-2026' });
    const rows = gapContribution(repo, ALL);
    for (const r of rows) expect(r.gapRate).toBeCloseTo(q1.find((g) => g.category === r.category)!.gapRate!, 12);
    expect(rows.find((r) => r.category === m.category)!.gapRate).toBeCloseTo(m.gapRate, 12);
    expect(rows).toEqual(gapContribution(repo, { ...ALL, quarter: 'Q1-2026' }));
  });

  test('hand-computed: one audit, an N/A subsection, an older quarter ignored', () => {
    const checklist: ChecklistItem[] = [
      { code: 'B1.1', section: 'B', subsection: 'B1', question: 'doc', weight: 2, category: 'documents' },
      { code: 'B6.1', section: 'B', subsection: 'B6', question: 'sub', weight: 1, category: 'subcontractor' },
      { code: 'B9.1', section: 'B', subsection: 'B9', question: 'site', weight: 1, category: 'site' },
    ];
    const audit = (id: string, quarter: Audit['quarter'], b1: number): Audit => ({
      id, contractorId: 'c1', quarter, date: quarter === 'Q1-2026' ? '2026-02-01' : '2025-11-01', location: '', inspectionNo: '',
      auditors: [], totalScore: 0.5,
      sections: [
        { code: 'B1', label: 'B1', possible: 4, scored: b1 },
        { code: 'B6', label: 'B6', possible: 4, scored: 0 },
        { code: 'B9', label: 'B9', possible: 0, scored: 0 }, // N/A -> site excluded, not in the weight total
      ],
    });
    const tiny: Repo = {
      checklist: () => checklist,
      contractors: () => [{ id: 'c1', name: 'C1', contractNo: '1', subregion: 'SR1' }],
      audits: () => [audit('old', 'Q4-2025', 4), audit('new', 'Q1-2026', 1)],
      observations: () => [],
    };
    // Q1: documents gap 1 - 1/4 = 0.75, weight share 2/3 -> 0.5; subcontractor gap 1, share 1/3 -> 1/3.
    // Lost total 5/6 -> documents 0.6, subcontractor 0.4.
    const rows = gapContribution(tiny, ALL);
    expect(rows.map((r) => r.category)).toEqual(['documents', 'subcontractor']);
    expect(rows[0].gapRate).toBeCloseTo(0.75, 12);
    expect(rows[0].share).toBeCloseTo(0.6, 12);
    expect(rows[1].gapRate).toBeCloseTo(1, 12);
    expect(rows[1].share).toBeCloseTo(0.4, 12);
    // Q4 alone: documents fully compliant -> all lost score is subcontractor's
    expect(gapContribution(tiny, { ...ALL, quarter: 'Q4-2025' })).toEqual([
      { category: 'documents', gapRate: 0, share: 0 },
      { category: 'subcontractor', gapRate: 1, share: 1 },
    ].sort((a, b) => b.share - a.share));
  });

  test('empty filter -> []', () => expect(gapContribution(repo, NONE)).toEqual([]));
  test('non-H&S type -> []', () => {
    for (const type of ['security', 'environmental', 'welfare', 'crc'] as const) expect(gapContribution(repo, { ...ALL, type })).toEqual([]);
  });
  test('filter all: top four shares', () => {
    expect(gapContribution(repo, ALL).slice(0, 4).map((r) => r.category)).toEqual(['documents', 'leadership', 'monitoring', 'subcontractor']);
  });
});
