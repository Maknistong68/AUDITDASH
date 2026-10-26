import { describe, expect, test } from 'vitest';
import checklistJson from '@/data/seed/checklist.json';
import fixture from './fixtures/abyatona-1112-responses.json';
import { bandFor, scoreResponses } from '@/lib/scoring';
import type { ChecklistItem, Compliance } from '@/lib/types';

const checklist = checklistJson as ChecklistItem[];
const mk = (code: string, weight: number, section: 'A' | 'B' | 'C' = 'A', subsection: string | null = null): ChecklistItem => ({
  code, section, subsection, question: 'q', weight, category: 'plans',
});

describe('scoreResponses', () => {
  test('ABYATONA-1112 checklist answers score 62.76%', () => {
    expect(scoreResponses(checklist, fixture as Record<string, Compliance>).score).toBeCloseTo(0.6276068, 6);
  });
  test('N/A excluded', () => expect(scoreResponses([mk('X', 3)], { X: 'na' }).score).toBeNull());
  test('empty / unanswered gives null', () => {
    expect(scoreResponses([], {}).score).toBeNull();
    expect(scoreResponses([mk('X', 3)], {}).score).toBeNull();
  });
  test('section with no applicable items is dropped from the mean', () => {
    const items = [mk('A1', 2), mk('B1.1', 1, 'B', 'B1')];
    expect(scoreResponses(items, { A1: 'full', 'B1.1': 'na' }).score).toBe(1);
  });
  test('B is a weighted mean over all items, C is mean of C1 and C2', () => {
    const items = [
      mk('B1.1', 3, 'B', 'B1'), mk('B2.1', 1, 'B', 'B2'),
      mk('C1.1', 1, 'C', 'C1'), mk('C2.1', 3, 'C', 'C2'),
    ];
    // B = (3*1 + 0)/4 = .75 ; C = mean(0.5, 1) = .75
    const r = scoreResponses(items, { 'B1.1': 'full', 'B2.1': 'no', 'C1.1': 'partial', 'C2.1': 'full' });
    expect(r.score).toBeCloseTo(0.75, 10);
    expect(r.possible).toBe(8);
    expect(r.scored).toBe(3 + 0.5 + 3);
  });
});

describe('bandFor', () => {
  test('bands', () => {
    expect(bandFor(0.9)).toBe('Excellent');
    expect(bandFor(0.8999)).toBe('Good');
    expect(bandFor(0.6276)).toBe('Minimally Compliant');
    expect(bandFor(0.59)).toBe('Non-Compliant');
    expect(bandFor(0.8)).toBe('Good');
    expect(bandFor(0.7)).toBe('Partially Compliant');
    expect(bandFor(0.6)).toBe('Minimally Compliant');
  });
});
