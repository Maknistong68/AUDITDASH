import { describe, expect, test } from 'vitest';
import { getRepo, type Repo } from '@/lib/data/repo';
import {
  applicableSlots, auditCompliance, categoryDetail, categoryGaps, contractorInCategory, filterAudits, itemHistory, league, portfolioSummary,
} from '@/lib/analytics';
import { CATEGORIES } from '@/lib/categories';
import type { Filter } from '@/lib/types';

const repo = getRepo();

// The importer drops "Not Applicable" notes, so the seed no longer has notes on N/A subsections.
// The analytics guard still matters (data from other sources), so inject one on TDP's N/A B5 subsection.
const NA_AUDIT = '4800000892-Q1-2026-20260315';
const naRepo: Repo = {
  ...repo,
  observations: () => [
    ...repo.observations(),
    { id: `${NA_AUDIT}-na`, auditId: NA_AUDIT, itemCode: 'B5.1', kind: 'negative', text: 'Utility clearance permit for excavation not seen', category: 'documents', hasPhoto: false },
  ],
};
const ALL: Filter = { quarter: 'all', regions: ['SR1', 'SR2'] };

describe('portfolio', () => {
  test('portfolio all', () => {
    const s = portfolioSummary(repo, ALL);
    expect(s.audits).toBe(20);
    expect(s.avgScore).toBeGreaterThan(0.6);
    expect(s.avgScore).toBeLessThan(0.75);
    expect(s.delta).not.toBeNull();
  });
  test('empty filter yields nulls not NaN', () => {
    const s = portfolioSummary(repo, { quarter: 'Q4-2025', regions: [] });
    expect(s).toMatchObject({ audits: 0, avgScore: null, band: null, delta: null, negatives: 0, positives: 0 });
  });
  test('delta null for Q4-2025', () => expect(portfolioSummary(repo, { ...ALL, quarter: 'Q4-2025' }).delta).toBeNull());
  test('avg uses seed totalScore', () => {
    const a = filterAudits(repo, ALL);
    expect(portfolioSummary(repo, ALL).avgScore).toBeCloseTo(a.reduce((s, x) => s + x.totalScore, 0) / a.length, 10);
  });
  test('filterAudits honours quarter, region and contractor', () => {
    const q = filterAudits(repo, { quarter: 'Q1-2026', regions: ['SR1', 'SR2'] });
    expect(q.every((a) => a.quarter === 'Q1-2026')).toBe(true);
    const sr2 = filterAudits(repo, { ...ALL, regions: ['SR2'] });
    const sr2ids = new Set(repo.contractors().filter((c) => c.subregion === 'SR2').map((c) => c.id));
    expect(sr2.every((a) => sr2ids.has(a.contractorId))).toBe(true);
    expect(filterAudits(repo, { ...ALL, contractorId: '4800000838' }).every((a) => a.contractorId === '4800000838')).toBe(true);
  });
});

describe('categoryGaps', () => {
  test('one gap per category, rates in [0,1] or null', () => {
    const g = categoryGaps(repo, ALL);
    expect(g).toHaveLength(CATEGORIES.length);
    g.forEach((x) => {
      if (x.gapRate !== null) { expect(x.gapRate).toBeGreaterThanOrEqual(0); expect(x.gapRate).toBeLessThanOrEqual(1); }
      expect(x.prevGapRate).toBeNull();
    });
  });
  test('prevGapRate only for Q1-2026', () => {
    const g = categoryGaps(repo, { ...ALL, quarter: 'Q1-2026' });
    expect(g.some((x) => x.prevGapRate !== null)).toBe(true);
    categoryGaps(repo, { ...ALL, quarter: 'Q4-2025' }).forEach((x) => expect(x.prevGapRate).toBeNull());
  });
  test('empty filter -> null rates, no NaN', () => {
    categoryGaps(repo, { quarter: 'all', regions: [] }).forEach((x) => expect(x).toMatchObject({ gapRate: null, findings: 0 }));
  });
  test('utility clearance N/A not in denominator', () => {
    const audit = repo.audits().find((a) => a.id === '4800001112-Q4-2025-20251015')!;
    expect(audit.sections.find((s) => s.code === 'B5')!.possible).toBe(0);
    const f: Filter = { quarter: audit.quarter, regions: ['SR1', 'SR2'], contractorId: audit.contractorId };
    const filtered = filterAudits(repo, f);
    expect(filtered).toHaveLength(1);
    const permitItems = repo.checklist().filter((i) => i.category === 'documents');
    const b5 = permitItems.filter((i) => i.subsection === 'B5').length;
    expect(b5).toBeGreaterThan(0);
    expect(applicableSlots(repo, f, 'documents')).toBe(permitItems.length - b5);
  });
});

describe('score-based gap', () => {
  const gap = (c: string, f: Filter = ALL) => categoryGaps(repo, f).find((x) => x.category === c)!;
  test('hand-computed permit-subsection compliance 4800001272-Q4', () => {
    const a = repo.audits().find((x) => x.id === '4800001272-Q4-2025-20251029')!;
    const items = repo.checklist().filter((i) => i.category === 'documents' && ['B4', 'B5'].includes(i.subsection));
    expect(auditCompliance(a, items)).toBeCloseTo((3 * 0.5 + 1 * 0.5 + 3 + 1 + 1) / 9, 10);
    expect(auditCompliance(a, items)).toBeCloseTo(0.7778, 4);
  });
  test('N/A subsection excluded from compliance', () => {
    const a = repo.audits().find((x) => x.id === '4800001112-Q4-2025-20251015')!;
    const permits = repo.checklist().filter((i) => i.category === 'documents' && ['B4', 'B5'].includes(i.subsection));
    const b4 = a.sections.find((s) => s.code === 'B4')!;
    expect(auditCompliance(a, permits)).toBeCloseTo(b4.scored / b4.possible, 10);
  });
  test('gap rates in [0,1] and spread >= 0.15 for all', () => {
    const rates = categoryGaps(repo, ALL).map((x) => x.gapRate!);
    rates.forEach((r) => { expect(r).toBeGreaterThanOrEqual(0); expect(r).toBeLessThanOrEqual(1); });
    expect(Math.max(...rates) - Math.min(...rates)).toBeGreaterThanOrEqual(0.15);
  });
  test('documents gap > health gap for all', () => expect(gap('documents').gapRate!).toBeGreaterThan(gap('health').gapRate!));
  test('findingRate present and bounded', () => categoryGaps(repo, ALL).forEach((x) => { expect(x.findingRate!).toBeGreaterThanOrEqual(0); expect(x.findingRate!).toBeLessThanOrEqual(1); }));
  test('findings exclude N/A-subsection negatives', () => {
    const f: Filter = { quarter: 'Q1-2026', regions: ['SR1', 'SR2'], contractorId: '4800000892' };
    const raw = naRepo.observations().filter((o) => o.auditId === '4800000892-Q1-2026-20260315' && o.category === 'documents' && o.kind !== 'positive');
    const na = raw.filter((o) => o.itemCode?.startsWith('B5.')).length;
    expect(na).toBeGreaterThan(0);
    expect(categoryGaps(naRepo, f).find((x) => x.category === 'documents')!.findings).toBe(raw.length - na);
  });
});

describe('league', () => {
  test('single-audit contractor has previous null', () =>
    expect(league(repo, ALL).find((l) => l.contractor.id === '4200000026')!.previous).toBeNull());
  test('JV-ECH trend up', () => {
    const l = league(repo, ALL).find((l) => l.contractor.id === '4800001131')!;
    expect(l.latest).toBe(0.85);
    expect(l.previous).toBe(0.74);
  });
  test('sorted desc', () => {
    const l = league(repo, ALL);
    expect(l.map((x) => x.latest)).toEqual([...l.map((x) => x.latest)].sort((a, b) => b - a));
  });
  test('SIBS: q=all uses Q1 latest and last Q4 as previous; q=Q4 has no previous', () => {
    const sibs = repo.audits().filter((a) => a.contractorId === '4800000838');
    const q1 = sibs.find((a) => a.quarter === 'Q1-2026')!;
    const q4 = sibs.filter((a) => a.quarter === 'Q4-2025').sort((a, b) => a.date.localeCompare(b.date));
    expect(q4).toHaveLength(2);
    const all = league(repo, ALL).find((l) => l.contractor.id === '4800000838')!;
    expect(all.latest).toBe(q1.totalScore);
    expect(all.previous).toBe(q4[1].totalScore);
    const onlyQ4 = league(repo, { ...ALL, quarter: 'Q4-2025' }).find((l) => l.contractor.id === '4800000838')!;
    expect(onlyQ4.latest).toBe(q4[1].totalScore);
    expect(onlyQ4.previous).toBeNull();
  });
  test('empty filter -> empty', () => expect(league(repo, { quarter: 'all', regions: [] })).toEqual([]));
});

describe('drill selectors', () => {
  test('itemHistory chronological', () => {
    const h = itemHistory(repo, '4800001272', 'B4.1');
    expect(h.length).toBeGreaterThan(0);
    expect(h.map((x) => x.audit.date)).toEqual([...h.map((x) => x.audit.date)].sort());
  });
  test('categoryDetail', () => {
    const d = categoryDetail(repo, ALL, 'documents');
    expect(d.contractors.length).toBeGreaterThan(0);
    d.contractors.forEach((c) => { expect(c.gapRate).toBeGreaterThanOrEqual(0); expect(c.gapRate).toBeLessThanOrEqual(1); });
    expect(d.items.every((i) => i.hits > 0)).toBe(true);
  });
  test('contractorInCategory', () => {
    const r = contractorInCategory(repo, ALL, 'documents', '4800001272');
    expect(r.audits.length).toBeGreaterThan(0);
    const permits = repo.checklist().filter((i) => i.category === 'documents');
    expect(r.items.map((i) => i.item.code)).toEqual(permits.map((i) => i.code));
    r.items.forEach((i) => expect(Object.keys(i.hitsByAudit).sort()).toEqual(r.audits.map((a) => a.id).sort()));
  });
});

describe('N/A notes imported as negatives', () => {
  test('negatives on N/A subsections do not inflate gaps or issues', () => {
    // audit 4800000892-Q1 has B5 possible 0 but three "N/A -" negatives on B5.x
    const f: Filter = { quarter: 'Q1-2026', regions: ['SR1', 'SR2'], contractorId: '4800000892' };
    const g = categoryGaps(repo, f).find((x) => x.category === 'documents')!;
    expect(g.gapRate).toBeLessThanOrEqual(1);
    expect(categoryDetail(repo, f, 'documents').items.some((i) => i.itemCode.startsWith('B5.'))).toBe(false);
  });
  test('all gap rates and contractor rates within [0,1] for every filter', () => {
    for (const quarter of ['all', 'Q4-2025', 'Q1-2026'] as const)
      for (const regions of [['SR1'], ['SR2'], ['SR1', 'SR2']] as const) {
        const f: Filter = { quarter, regions: [...regions] };
        categoryGaps(repo, f).forEach((x) => x.gapRate === null || (expect(x.gapRate).toBeLessThanOrEqual(1), expect(x.prevGapRate ?? 0).toBeLessThanOrEqual(1)));
        categoryDetail(repo, f, 'documents').contractors.forEach((c) => expect(c.gapRate).toBeLessThanOrEqual(1));
      }
  });
});

describe('N/A notes excluded from summary and history', () => {
  test('portfolio negatives exclude N/A notes', () => {
    const f: Filter = { quarter: 'Q1-2026', regions: ['SR1', 'SR2'], contractorId: '4800000892' };
    const raw = naRepo.observations().filter((o) => o.auditId === '4800000892-Q1-2026-20260315' && o.kind !== 'positive');
    const na = raw.filter((o) => o.itemCode?.startsWith('B5.')).length;
    expect(na).toBeGreaterThan(0);
    expect(portfolioSummary(naRepo, f).negatives).toBe(raw.length - na);
  });
  test('itemHistory returns null observation for N/A audit but keeps the row', () => {
    const h = itemHistory(repo, '4800000892', 'B5.1');
    const row = h.find((x) => x.audit.id === '4800000892-Q1-2026-20260315')!;
    expect(row).toBeDefined();
    expect(row.observation).toBeNull();
    expect(h).toHaveLength(repo.audits().filter((a) => a.contractorId === '4800000892').length);
  });
});
