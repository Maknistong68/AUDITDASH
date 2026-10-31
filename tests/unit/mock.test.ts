import { afterEach, expect, test } from 'vitest';
import { getRepo } from '@/lib/data/repo';

afterEach(() => { delete process.env.DATA_SOURCE; });

test('mock repo loads seed', async () => {
  const r = await getRepo();
  expect(r.audits()).toHaveLength(20);
  expect(r.checklist()).toHaveLength(81);
  expect(r.contractors().length).toBeGreaterThan(0);
  expect(r.observations().length).toBeGreaterThan(0);
});
test('supabase source needs its environment', async () => {
  process.env.DATA_SOURCE = 'supabase';
  await expect(getRepo()).rejects.toThrow('NEXT_PUBLIC_SUPABASE_URL');
});
