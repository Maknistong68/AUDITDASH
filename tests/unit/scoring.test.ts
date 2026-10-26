import { describe, expect, test } from 'vitest';
import checklistJson from '@/data/seed/checklist.json';
import fixture from './fixtures/abyatona-1112-responses.json';
import { bandFor, scoreResponses } from '@/lib/scoring';
import { scoreAppAudit } from '@/lib/appScoring';
import { checklistFor } from '@/lib/auditTypes';
import type { AppAnswer, ChecklistItem, Compliance } from '@/lib/types';

const checklist = checklistJson as ChecklistItem[];
const mk = (code: string, weight: number, section: 'A' | 'B' | 'C' = 'A', subsection: string | null = null): ChecklistItem => ({
  code, section, subsection, question: 'q', weight, category: 'documents',
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

describe('scoreAppAudit', () => {
  const map: Record<string, AppAnswer> = { full: 'compliant', partial: 'observation', no: 'non_compliant', na: 'na' };
  test('H&S fixture mapped answers score 62.76%', () => {
    const answers = Object.fromEntries(Object.entries(fixture as Record<string, string>).map(([k, v]) => [k, map[v]]));
    const r = scoreAppAudit('hs', checklistFor('hs'), answers);
    expect(r.score).toBeCloseTo(0.6276068, 6);
    expect(r.sections.map((s) => s.code)).toEqual(['A', 'B', 'C']);
    expect(r.counts.compliant + r.counts.observation + r.counts.nonCompliant + r.counts.na + r.counts.unanswered).toBe(81);
  });
  test('Security: mean of section scores', () => {
    const items = checklistFor('security');
    const a = items.filter((i) => i.section === 'A'); // 4 items
    const b = items.filter((i) => i.section === 'B'); // 3 items
    const answers: Record<string, AppAnswer> = {};
    a.forEach((i, n) => (answers[i.code] = n === 0 ? 'observation' : 'compliant')); // 3.5/4 = .875
    b.forEach((i, n) => (answers[i.code] = n === 0 ? 'non_compliant' : n === 1 ? 'na' : 'compliant')); // 1/2 = .5
    const r = scoreAppAudit('security', items, answers);
    expect(r.sections.find((s) => s.code === 'A')).toMatchObject({ title: 'Documentation', score: 0.875 });
    expect(r.sections.find((s) => s.code === 'B')?.score).toBe(0.5);
    expect(r.sections.find((s) => s.code === 'C')?.score).toBeNull();
    expect(r.score).toBeCloseTo((0.875 + 0.5) / 2, 10);
    expect(r.counts).toEqual({ compliant: 4, nonCompliant: 1, observation: 1, na: 1, unanswered: items.length - 7 });
  });
  test('weights apply within a section (environmental B2 has weight 3)', () => {
    const items = checklistFor('environmental').filter((i) => i.code === 'B1' || i.code === 'B2');
    const r = scoreAppAudit('environmental', items, { B1: 'non_compliant', B2: 'compliant' });
    expect(r.score).toBeCloseTo(3 / 4, 10);
  });
  test('CRC: 13 areas weight 1, mean of one section', () => {
    const items = checklistFor('crc');
    const answers: Record<string, AppAnswer> = {};
    items.forEach((i, n) => (answers[i.code] = n < 6 ? 'compliant' : n < 8 ? 'observation' : n < 12 ? 'non_compliant' : 'na'));
    const r = scoreAppAudit('crc', items, answers);
    expect(r.score).toBeCloseTo((6 + 1) / 12, 10);
    expect(r.counts.na).toBe(1);
  });
  test('nothing answered or all N/A -> null', () => {
    expect(scoreAppAudit('crc', checklistFor('crc'), {}).score).toBeNull();
    expect(scoreAppAudit('crc', checklistFor('crc'), { CRC1: 'na' }).score).toBeNull();
  });
});
