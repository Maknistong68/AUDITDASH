import { describe, expect, test } from 'vitest';
import { getRepo } from '@/lib/data/repo';
import { ITEM_LABELS, itemLabel, trimQuestion } from '@/lib/itemLabels';

const checklist = getRepo().checklist();

describe('itemLabels', () => {
  test('every H&S checklist code has a hand-written label of at most 40 chars, with no code in it', () => {
    expect(checklist).toHaveLength(81);
    for (const i of checklist) {
      const l = ITEM_LABELS[i.code];
      expect(l, i.code).toBeTruthy();
      expect(l.length, `${i.code}: ${l}`).toBeLessThanOrEqual(40);
      expect(l).not.toMatch(/\b[ABC]\d+(\.\d+)?\b/);
      expect(itemLabel(i.code, i.question)).toBe(l);
    }
    expect(Object.keys(ITEM_LABELS).sort()).toEqual(checklist.map((i) => i.code).sort());
  });
  test('labels are unique', () => {
    const v = Object.values(ITEM_LABELS);
    expect(new Set(v).size).toBe(v.length);
  });
  test('unknown codes fall back to a trimmed question', () => {
    expect(itemLabel('Z9.9', 'Is there a permit office for coordination, issue and closure of all permits on the project?'))
      .toBe('Permit office for coordination, issue…');
    expect(trimQuestion('Are flammables stored properly?')).toBe('Flammables stored properly');
    expect(itemLabel('Z9.9', 'x'.repeat(80)).length).toBeLessThanOrEqual(40);
    expect(itemLabel('Z9.9')).toBe('Z9.9');
  });
});
