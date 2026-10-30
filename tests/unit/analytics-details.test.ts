import { describe, expect, it } from 'vitest';
import { getRepo } from '@/lib/data/repo';
import {
  auditFindings, auditGaps, auditItemStates, categoryQuarters, itemTimeline, contractorAudits, isNaObservation, sectionRatios,
} from '@/lib/analytics';
import { CATEGORIES } from '@/lib/categories';
import type { Filter } from '@/lib/types';

const repo = getRepo();
const ALL: Filter = { quarter: 'all', regions: ['SR1', 'SR2'] };

describe('contractorAudits', () => {
  it('is latest first and ignores the quarter filter', () => {
    const rows = contractorAudits(repo, { ...ALL, quarter: 'Q1-2026' }, '4800001131');
    expect(rows.map((r) => r.audit.quarter)).toEqual(['Q1-2026', 'Q4-2025']);
    expect(rows[0].previous?.id).toBe(rows[1].audit.id);
    expect(rows[1].previous).toBeNull();
    expect(rows[1].audit.totalScore).toBeCloseTo(0.7604, 4); // computed from its points (Excel typed 74%)
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
  it('lists every category worst first, N/A last, gaps within 0..1', () => {
    const a = repo.audits()[0];
    const g = auditGaps(repo, a);
    expect(g).toHaveLength(CATEGORIES.length);
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
  it('opens on every audit (under all), then latest quarter first with the previous quarter gap carried', () => {
    const qs = categoryQuarters(repo, ALL, 'subcontractor');
    expect(qs.map((q) => q.quarter)).toEqual(['all', 'Q3-2026', 'Q1-2026', 'Q4-2025']);
    expect(Math.round(qs[0].gapRate! * 100)).toBe(73); // = the dashboard's main problem card
    expect(qs[0].prevGapRate).toBeNull();
    expect(qs[1].prevGapRate).toBe(qs[2].gapRate);
    expect(qs[2].prevGapRate).toBe(qs[3].gapRate);
    expect(qs[3].prevGapRate).toBeNull();
    const gaps = qs[0].contractors.map((c) => c.gapRate);
    expect(gaps).toEqual([...gaps].sort((a, b) => b - a));
    // A selected quarter: no every-audit slide.
    expect(categoryQuarters(repo, { ...ALL, quarter: 'Q1-2026' }, 'subcontractor').map((q) => q.quarter)).toEqual(['Q3-2026', 'Q1-2026', 'Q4-2025']);
  });
  it('skips quarters without audits in the regions', () => {
    expect(categoryQuarters(repo, { ...ALL, regions: [] }, 'documents')).toEqual([]);
  });
});

describe('auditItemStates', () => {
  it('marks N/A subsections and findings', () => {
    const a = repo.audits().find((x) => x.sections.some((s) => s.code === 'B5' && s.possible === 0));
    if (a) expect(auditItemStates(repo, a, 'documents').filter((r) => r.item.subsection === 'B5').every((r) => r.state === 'na')).toBe(true);
    const b = repo.audits()[0];
    const rows = auditItemStates(repo, b, 'subcontractor');
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.state === 'noted').toBe(r.observation !== null);
      expect(r.state === 'na').toBe(r.ratio === null);
      if (r.ratio !== null) expect(r.ratio >= 0 && r.ratio <= 1).toBe(true);
    }
  });
});

describe('itemTimeline', () => {
  it('is latest first, matches auditItemStates per audit, and respects regions', () => {
    const item = repo.checklist().find((i) => i.code === 'B6.1')!;
    const t = itemTimeline(repo, ALL, '4800001131', item);
    expect(t.map((x) => x.audit.quarter)).toEqual(['Q1-2026', 'Q4-2025']);
    for (const e of t) {
      const s = auditItemStates(repo, e.audit, 'subcontractor').find((r) => r.item.code === 'B6.1')!;
      expect(e.state).toBe(s.state);
      expect(e.ratio).toBe(s.ratio);
    }
    expect(itemTimeline(repo, { ...ALL, regions: ['SR1'] }, '4800001131', item)).toEqual([]);
  });
});

describe('driving items by impact', () => {
  it('ranks by hits x (1 - mean subsection score) and keeps severity in 0..1', () => {
    const q = categoryQuarters(repo, ALL, 'subcontractor')[0];
    const imp = q.items.map((i) => i.impact);
    expect(imp).toEqual([...imp].sort((a, b) => b - a));
    for (const i of q.items) {
      expect(i.severity >= 0 && i.severity <= 1).toBe(true);
      expect(i.impact).toBeCloseTo(i.hits * i.severity, 10);
    }
  });
});

describe('sectionRatios', () => {
  it('A and B are points ratios; C is the mean of C1 and C2 (the workbook formula)', () => {
    const a = repo.audits().find((x) => x.id === '4800001134-Q4-2025-20251022')!;
    const r = sectionRatios(a);
    expect(r.A).toBeCloseTo(27 / 45);
    expect(r.B).toBeCloseTo(40 / 67);
    expect(r.C).toBeCloseTo((4.5 / 13 + 15 / 21) / 2);
  });
});

describe('categoryQuarters "Driven by" order', () => {
  it('audits noted desc, then impact desc: the bars are monotonic in every category and quarter', () => {
    for (const c of CATEGORIES) {
      for (const q of categoryQuarters(repo, ALL, c.id)) {
        for (let i = 1; i < q.items.length; i++) {
          const [a, b] = [q.items[i - 1], q.items[i]];
          expect(a.hits).toBeGreaterThanOrEqual(b.hits);
          if (a.hits === b.hits) expect(a.impact).toBeGreaterThanOrEqual(b.impact);
        }
      }
    }
  });
});
