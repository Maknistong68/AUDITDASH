import { expect, test } from 'vitest';
import checklistJson from '@/data/seed/checklist.json';
import { CATEGORIES, categoryById, categoryForCode } from '@/lib/categories';
import type { ChecklistItem } from '@/lib/types';

const checklist = checklistJson as ChecklistItem[];

test('TS category map agrees with seed', () =>
  checklist.forEach((i) => expect(categoryForCode(i.code)).toBe(i.category)));
test('categoryById', () => expect(categoryById('documents').short).toBeTruthy());
test('unknown codes fall to site', () => expect(categoryForCode('Z9')).toBe('site'));
test('colors and icons are distinct', () => {
  expect(new Set(CATEGORIES.map((c) => c.color)).size).toBe(CATEGORIES.length);
  expect(new Set(CATEGORIES.map((c) => c.icon)).size).toBe(CATEGORIES.length);
});

test('8 categories in the owner order', () =>
  expect(CATEGORIES.map((c) => c.id)).toEqual(['leadership', 'documents', 'competence', 'subcontractor', 'monitoring', 'incident', 'site', 'health']));
test('Site Compliance keeps the site id', () => {
  expect(categoryById('site').name).toBe('Site Compliance');
  expect(categoryById('site').short).toBe('Site');
});
test('Documents code set is the union of the old plans, rams and permits sets', () => {
  const expected = [
    'A1', 'A2', 'A6', 'A13',
    ...Array.from({ length: 4 }, (_, i) => `C2.${2 + i}`), ...Array.from({ length: 13 }, (_, i) => `C2.${7 + i}`),
    'B1.1', 'B1.2', 'C1.9', 'C1.10', 'C1.11', 'C1.12',
    'B4.1', 'B4.2', 'B5.1', 'B5.2', 'B5.3',
  ];
  const actual = checklist.filter((i) => categoryForCode(i.code) === 'documents').map((i) => i.code);
  expect([...actual].sort()).toEqual([...expected].sort());
  expected.forEach((c) => expect(categoryForCode(c)).toBe('documents'));
});
test('categoryForCode: permits to documents, unmapped to site', () => {
  expect(categoryForCode('B4.1')).toBe('documents');
  expect(categoryForCode('B10.1')).toBe('site');
});
