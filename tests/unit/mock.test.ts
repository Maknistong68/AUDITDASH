import { afterEach, expect, test } from 'vitest';
import { getRepo } from '@/lib/data/repo';

afterEach(() => { delete process.env.DATA_SOURCE; });

test('mock repo loads seed', () => {
  const r = getRepo();
  expect(r.audits()).toHaveLength(20);
  expect(r.checklist()).toHaveLength(81);
  expect(r.contractors().length).toBeGreaterThan(0);
  expect(r.observations().length).toBeGreaterThan(0);
});
test('supabase source not implemented', () => {
  process.env.DATA_SOURCE = 'supabase';
  expect(() => getRepo()).toThrow('DATA_SOURCE=supabase not implemented yet');
});
