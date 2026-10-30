import { describe, expect, test } from 'vitest';
import { getRepo } from '@/lib/data/repo';
import { categoryCard, categoryCards, categoryDetail, categoryGaps, mainProblem } from '@/lib/analytics';
import { CATEGORIES } from '@/lib/categories';
import type { Filter } from '@/lib/types';

const repo = getRepo();
const ALL: Filter = { quarter: 'all', regions: ['SR1', 'SR2'] };
const FILTERS: Filter[] = [
  ALL,
  { quarter: 'Q4-2025', regions: ['SR1', 'SR2'] },
  { quarter: 'Q1-2026', regions: ['SR1', 'SR2'] },
  { quarter: 'all', regions: ['SR1'] },
  { quarter: 'all', regions: ['SR2'] },
];

describe('categoryCard', () => {
  test('the main problem category gives exactly the dashboard card (74% on the full filter)', () => {
    for (const f of FILTERS) {
      const m = mainProblem(repo, f)!;
      expect(categoryCard(repo, f, m.category)).toEqual(m);
    }
    const c = categoryCard(repo, ALL, mainProblem(repo, ALL)!.category)!;
    expect(Math.round(c.gapRate * 100)).toBe(74);
    expect(c.quarter).toBe('all');
  });

  test('any category: the scope gap, the previous quarter gap (a quarter selected) and top 3 driving items', () => {
    // Under 'all': every audit, no comparison.
    for (const g of categoryGaps(repo, ALL).filter((x) => x.gapRate !== null)) {
      const c = categoryCard(repo, ALL, g.category)!;
      expect(c.quarter).toBe('all');
      expect(c.gapRate).toBeCloseTo(g.gapRate!, 12);
      expect(c.prevGapRate).toBeNull();
      expect(c.items).toEqual(categoryDetail(repo, ALL, g.category).items.slice(0, 3));
    }
    // A quarter: that quarter, against the quarter before it.
    const Q1: Filter = { ...ALL, quarter: 'Q1-2026' };
    const q1 = categoryGaps(repo, Q1);
    const q4 = categoryGaps(repo, { ...ALL, quarter: 'Q4-2025' });
    for (const g of q1.filter((x) => x.gapRate !== null)) {
      const c = categoryCard(repo, Q1, g.category)!;
      expect(c.quarter).toBe('Q1-2026');
      expect(c.gapRate).toBeCloseTo(g.gapRate!, 12);
      expect(c.prevGapRate).toBeCloseTo(q4.find((x) => x.category === g.category)!.gapRate!, 12);
      expect(c.items).toEqual(categoryDetail(repo, Q1, g.category).items.slice(0, 3));
    }
  });

  test('no previous quarter in the filter -> prevGapRate null; empty filter or other type -> null', () => {
    expect(categoryCard(repo, { ...ALL, quarter: 'Q4-2025' }, 'subcontractor')!.prevGapRate).toBeNull();
    expect(categoryCard(repo, { quarter: 'all', regions: [] }, 'subcontractor')).toBeNull();
    expect(categoryCard(repo, { ...ALL, type: 'security' }, 'subcontractor')).toBeNull();
  });
});

describe('categoryCards', () => {
  test('worst latest-quarter gap first; #1 is the main problem; every category with a gap once', () => {
    for (const f of FILTERS) {
      const cards = categoryCards(repo, f);
      expect(cards[0]).toEqual(mainProblem(repo, f));
      for (let i = 1; i < cards.length; i++) expect(cards[i - 1].gapRate).toBeGreaterThanOrEqual(cards[i].gapRate);
      expect(new Set(cards.map((c) => c.category)).size).toBe(cards.length);
    }
    expect(categoryCards(repo, ALL)).toHaveLength(CATEGORIES.length);
    expect(categoryCards(repo, { quarter: 'all', regions: [] })).toEqual([]);
  });
});
