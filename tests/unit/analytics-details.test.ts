import { describe, expect, it } from 'vitest';
import { getRepo } from '@/lib/data/repo';
import {
  auditFindings, auditGaps, auditItemStates, categoryQuarters, contractorAudits, isNaObservation, sectionRatios,
} from '@/lib/analytics';
import type { Filter } from '@/lib/types';

const repo = getRepo();
const ALL: Filter = { quarter: 'all', regions: ['SR1', 'SR2'] };

describe('contractorAudits', () => {
  it('is latest first and ignores the quarter filter', () => {
    const rows = contractorAudits(repo, { ...ALL, quarter: 'Q1-2026' }, '4800001131');
    expect(rows.map((r) => r.audit.quarter)).toEqual(['Q1-2026', 'Q4-2025']);
    expect(rows[0].previous?.id).toBe(rows[1].audit.id);
    expect(rows[1].previous).toBeNull();
    expect(rows[1].audit.totalScore).toBeCloseTo(0.74);
  });
  it('respects regions', () => {
    expect(contractorAudits(repo, { ...ALL, regions: ['SR1'] }, '4800001131')).toEqual([]);
  });
  it('orders two audits in one quarter by date', () => {
    const rows = contractorAudits(repo, ALL, '4800000838');
    expect(rows.map((r) => r.audit.date)).toEqual(['2026-02-01', '2025-11-19', '2025-11-12']);
  });
});

describe('auditGaps', () => {
  it('lists ten categories worst first, N/A last, gaps within 0..1', () => {
    const a = repo.audits()[0];
    const g = auditGaps(repo, a);
    expect(g).toHaveLength(10);
    const vals = g.map((x) => x.gapRate).filter((x): x is number => x !== null);
    expect(vals).toEqual([...vals].sort((x, y) => y - x));
    for (const v of vals) expect(v >= 0 && v <= 1).toBe(true);
    const firstNull = g.findIndex((x) => x.gapRate === null);
    if (firstNull >= 0) expect(g.slice(firstNull).every((x) => x.gapRate === null)).toBe(true);
  });
});

describe('auditFindings', () => {
  it('groups non-positive notes by category, excludes N/A notes, counts positives', () => {
    for (const a of repo.audits()) {
      const { groups, positives } = auditFindings(repo, a);
      const all = groups.flatMap((g) => g.observations);
      expect(all.every((o) => o.kind !== 'positive' && o.auditId === a.id && o.category !== null)).toBe(true);
      expect(all.some((o) => isNaObservation(repo, o))).toBe(false);
      expect(positives).toBe(repo.observations().filter((o) => o.auditId === a.id && o.kind === 'positive').length);
      const sizes = groups.map((g) => g.observations.length);
      expect(sizes).toEqual([...sizes].sort((x, y) => y - x));
    }
  });
});

describe('categoryQuarters', () => {
  it('is latest first with the previous quarter gap carried', () => {
    const qs = categoryQuarters(repo, ALL, 'subcontractor');
    expect(qs.map((q) => q.quarter)).toEqual(['Q1-2026', 'Q4-2025']);
    expect(qs[0].prevGapRate).toBe(qs[1].gapRate);
    expect(qs[1].prevGapRate).toBeNull();
    const gaps = qs[0].contractors.map((c) => c.gapRate);
    expect(gaps).toEqual([...gaps].sort((a, b) => b - a));
    expect(Math.round(qs[0].gapRate! * 100)).toBe(73);
  });
  it('skips quarters without audits in the regions', () => {
    expect(categoryQuarters(repo, { ...ALL, regions: [] }, 'plans')).toEqual([]);
  });
});

describe('auditItemStates', () => {
  it('marks N/A subsections and findings', () => {
    const a = repo.audits().find((x) => x.sections.some((s) => s.code === 'B5' && s.possible === 0));
    if (a) expect(auditItemStates(repo, a, 'permits').filter((r) => r.item.subsection === 'B5').every((r) => r.state === 'na')).toBe(true);
    const b = repo.audits()[0];
    const rows = auditItemStates(repo, b, 'subcontractor');
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.state === 'finding').toBe(r.observation !== null);
  });
});

describe('sectionRatios', () => {
  it('reads A/B/C from the official sections', () => {
    const a = repo.audits()[0];
    const r = sectionRatios(a);
    expect(r.A).toBeCloseTo(27 / 45);
  });
});
