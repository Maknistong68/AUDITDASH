import { expect, test } from 'vitest';
import checklistJson from '@/data/seed/checklist.json';
import { CATEGORIES, categoryById, categoryForCode } from '@/lib/categories';
import type { ChecklistItem } from '@/lib/types';

const checklist = checklistJson as ChecklistItem[];

test('TS category map agrees with seed', () =>
  checklist.forEach((i) => expect(categoryForCode(i.code)).toBe(i.category)));
test('10 categories', () =>
  expect(CATEGORIES.map((c) => c.id)).toEqual(['leadership','plans','rams','permits','competence','subcontractor','monitoring','incident','site','health']));
test('categoryById', () => expect(categoryById('rams').short).toBeTruthy());
test('unknown codes fall to site', () => expect(categoryForCode('Z9')).toBe('site'));
test('colors and icons are distinct', () => {
  expect(new Set(CATEGORIES.map((c) => c.color)).size).toBe(10);
  expect(new Set(CATEGORIES.map((c) => c.icon)).size).toBe(10);
});
