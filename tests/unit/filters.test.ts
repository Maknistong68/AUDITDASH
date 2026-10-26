import { expect, test } from 'vitest';
import { filterToQuery, parseFilter } from '@/lib/filters';

const p = (s: string) => parseFilter(new URLSearchParams(s));

test('filter round-trip', () =>
  expect(p(filterToQuery({ quarter: 'Q1-2026', regions: ['SR2'] }))).toEqual({ quarter: 'Q1-2026', regions: ['SR2'] }));
test('bad params fall back to defaults', () =>
  expect(p('q=zzz&r=XX')).toEqual({ quarter: 'all', regions: ['SR1', 'SR2'] }));
test('absent params -> defaults', () => expect(p('')).toEqual({ quarter: 'all', regions: ['SR1', 'SR2'] }));
test('empty r is explicit none and round-trips', () => {
  expect(p('r=')).toEqual({ quarter: 'all', regions: [] });
  const f = { quarter: 'Q4-2025' as const, regions: [] };
  expect(filterToQuery(f)).toContain('r=');
  expect(p(filterToQuery(f))).toEqual(f);
});
test('invalid tokens dropped', () => expect(p('r=SR1,XX')).toEqual({ quarter: 'all', regions: ['SR1'] }));
test('contractorId never in URL', () =>
  expect(filterToQuery({ quarter: 'all', regions: ['SR1'], contractorId: '4800001112' })).not.toContain('4800001112'));
