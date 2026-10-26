import { describe, expect, test } from 'vitest';
import { AUDIT_TYPES, categoriesFor, checklistFor } from '@/lib/auditTypes';
import { CATEGORIES } from '@/lib/categories';
import { filterAudits } from '@/lib/analytics';
import { mockRepo } from '@/lib/data/mock';
import { filterToQuery, parseFilter } from '@/lib/filters';

describe('auditTypes', () => {
  test('five types with labels', () => {
    expect(AUDIT_TYPES.map((t) => [t.id, t.label, t.short])).toEqual([
      ['hs', 'Health & Safety', 'H&S'], ['security', 'Security', 'Security'],
      ['environmental', 'Environmental', 'Environmental'], ['welfare', 'Welfare', 'Welfare'], ['crc', 'CRC', 'CRC'],
    ]);
  });
  test('checklists load with unique codes; CRC has 13', () => {
    for (const t of AUDIT_TYPES) {
      const items = checklistFor(t.id);
      expect(items.length).toBeGreaterThan(0);
      expect(new Set(items.map((i) => i.code)).size).toBe(items.length);
    }
    expect(checklistFor('crc')).toHaveLength(13);
    expect(checklistFor('hs')).toHaveLength(81);
  });
  test('categories: H&S = the CATEGORIES, others = sections', () => {
    expect(categoriesFor('hs').map((c) => c.id)).toEqual(CATEGORIES.map((c) => c.id));
    const sec = categoriesFor('security');
    expect(sec).toHaveLength(17);
    expect(sec[0]).toMatchObject({ id: 'security:A', name: 'Documentation' });
    expect(categoriesFor('crc').map((c) => c.id)).toEqual(['crc:A']);
    for (const c of sec) expect(checklistFor('security').some((i) => i.category === c.id)).toBe(true);
  });
});

describe('filter type', () => {
  const p = (s: string) => parseFilter(new URLSearchParams(s));
  test('t round-trips', () => {
    const f = { quarter: 'all' as const, regions: ['SR1' as const], type: 'security' as const };
    expect(filterToQuery(f)).toContain('t=security');
    expect(p(filterToQuery(f))).toEqual(f);
  });
  test('hs omitted from URL; invalid or absent -> hs', () => {
    expect(filterToQuery({ quarter: 'all', regions: ['SR1'], type: 'hs' })).not.toContain('t=');
    expect(p('t=zzz').type ?? 'hs').toBe('hs');
    expect(p('').type ?? 'hs').toBe('hs');
  });
  test('non-hs type has no seed audits', () => {
    const base = { quarter: 'all' as const, regions: ['SR1' as const, 'SR2' as const] };
    expect(filterAudits(mockRepo, base).length).toBeGreaterThan(0);
    expect(filterAudits(mockRepo, { ...base, type: 'security' })).toEqual([]);
  });
});
