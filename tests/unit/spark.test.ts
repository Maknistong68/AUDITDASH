import { describe, expect, it } from 'vitest';
import { sparkRates } from '../../lib/spark';

describe('sparkRates', () => {
  it('normalises hits by each quarter’s audit count, in quarter order', () => {
    expect(sparkRates({ 'Q4-2025': 4, 'Q1-2026': 6 }, { 'Q4-2025': 8, 'Q1-2026': 12 })).toEqual([
      { quarter: 'Q4-2025', rate: 0.5 },
      { quarter: 'Q1-2026', rate: 0.5 },
    ]);
  });
  it('drops quarters with no audits (single point, never NaN)', () => {
    const r = sparkRates({ 'Q4-2025': 0, 'Q1-2026': 3 }, { 'Q4-2025': 0, 'Q1-2026': 12 });
    expect(r).toEqual([{ quarter: 'Q1-2026', rate: 0.25 }]);
    expect(r.every((p) => Number.isFinite(p.rate))).toBe(true);
  });
  it('returns nothing when no quarter has audits', () => {
    expect(sparkRates({ 'Q4-2025': 0, 'Q1-2026': 0 }, { 'Q4-2025': 0, 'Q1-2026': 0 })).toEqual([]);
  });
});
