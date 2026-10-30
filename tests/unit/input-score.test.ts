import { describe, expect, it } from 'vitest';
import { checklistFor, sectionsFor } from '@/lib/auditTypes';
import { autoCategory, autoCategoryFor, siteCategory } from '@/lib/input/categorise';
import { contractorForProject } from '@/lib/input/contractors';
import { emptyDraft } from '@/lib/input/model';
import { liveScore, missingForSubmit, quarterOf, sectionsFromAnswers, toSeedRows } from '@/lib/input/score';
import { deleteSaved, loadSaved, saveDraft, STORAGE_KEY } from '@/lib/input/storage';
import type { ChecklistItem, Compliance } from '@/lib/types';

const items = checklistFor('hs');
const hs = items as unknown as ChecklistItem[];
const secs = sectionsFor('hs');

/** Every item answered with `v`, except overrides. */
const all = (v: Compliance, over: Record<string, Compliance> = {}) => Object.fromEntries(items.map((i) => [i.code, over[i.code] ?? v]));

describe('liveScore (H&S)', () => {
  it('is 100% when everything is Full, 0% when everything is No, null when nothing applies', () => {
    expect(liveScore('hs', items, secs, all('full')).total).toBe(1);
    expect(liveScore('hs', items, secs, all('no')).total).toBe(0);
    expect(liveScore('hs', items, secs, all('na')).total).toBeNull();
    expect(liveScore('hs', items, secs, {}).total).toBeNull();
  });
  it('follows the workbook formula: mean(A, B, mean(C1, C2)), no +0.012', () => {
    // A all Full, B all No, C1 all Full, C2 all Partial -> A 1, B 0, C = (1 + 0.5) / 2 = 0.75 -> total 0.5833
    const ans: Record<string, Compliance> = {};
    for (const i of hs) ans[i.code] = i.section === 'A' ? 'full' : i.section === 'B' ? 'no' : i.subsection === 'C1' ? 'full' : 'partial';
    const s = liveScore('hs', items, secs, ans);
    expect(s.sections.map((x) => [x.code, x.ratio])).toEqual([['A', 1], ['B', 0], ['C', 0.75]]);
    expect(s.cParts.map((x) => x.ratio)).toEqual([1, 0.5]);
    expect(s.total).toBeCloseTo(1.75 / 3, 10);
    expect(s.band).toBe('Non-Compliant');
  });
  it('excludes N/A from both sides and drops a section with nothing applicable', () => {
    const ans: Record<string, Compliance> = {};
    for (const i of hs) ans[i.code] = i.section === 'A' ? 'na' : 'full';
    expect(liveScore('hs', items, secs, ans).total).toBe(1);
  });
  it('counts answered, findings (Partial + No), N/A and open questions', () => {
    const [a, b, c, d] = items.map((i) => i.code);
    const s = liveScore('hs', items, secs, { [a]: 'full', [b]: 'partial', [c]: 'no', [d]: 'na' });
    expect(s.counts).toMatchObject({ items: items.length, answered: 4, findings: 2, na: 1, unanswered: items.length - 4 });
  });
  it('scores other audit types as the mean of their sections', () => {
    const sec = checklistFor('crc');
    const ans = Object.fromEntries(sec.map((i, n) => [i.code, n === 0 ? 'no' : 'full'])) as Record<string, Compliance>;
    const s = liveScore('crc', sec, sectionsFor('crc'), ans);
    const w = sec.reduce((t, i) => t + i.weight, 0);
    expect(s.total).toBeCloseTo((w - sec[0].weight) / w, 10);
    expect(s.cParts).toEqual([]);
  });
});

describe('sectionsFromAnswers', () => {
  it('rebuilds Part 2 points: Partial = half weight, N/A excluded', () => {
    const b111 = hs.find((i) => i.code === 'B11.1')!;
    const rows = sectionsFromAnswers(hs, { 'B11.1': 'partial', 'B11.2': 'na' });
    expect(rows.map((r) => r.code)).toEqual(['A', 'B', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'C', 'C1', 'C2']);
    expect(rows.find((r) => r.code === 'B11')).toEqual({ code: 'B11', label: 'Medical', possible: b111.weight, scored: b111.weight / 2 });
    expect(rows.find((r) => r.code === 'B')!.possible).toBe(b111.weight);
    expect(rows.find((r) => r.code === 'A')!.possible).toBe(0);
  });
});

describe('categories', () => {
  it('ports the site keyword rule', () => {
    expect(siteCategory('No training records for riggers')).toBe('competence');
    expect(siteCategory('Expired CERTIFICATE on crane')).toBe('competence');
    expect(siteCategory('Toilets not cleaned')).toBe('health');
    expect(siteCategory('No drinking water at the rest shelter')).toBe('health');
    expect(siteCategory('Waterproofing membrane torn')).toBe('site');
    expect(siteCategory('Scaffold tag missing')).toBe('site');
  });
  it('maps codes through the checklist categories; positives have none', () => {
    expect(autoCategory('B11.2', 'finding', 'x')).toBe('health');
    expect(autoCategory('A1', 'finding', 'training')).toBe('documents');
    expect(autoCategory(null, 'positive', 'training')).toBeNull();
    expect(autoCategoryFor('security', 'A1', 'finding', 'Guard training missing')).toBe('competence');
  });
});

describe('contractors', () => {
  it('maps known project strings (whitespace-insensitive) and leaves others to the auditor', () => {
    expect(contractorForProject('AL FAHD-4800001272')).toBe('4800001272');
    expect(contractorForProject('  SIBS   838 ')).toBe('4800000838');
    expect(contractorForProject('Somebody else')).toBeNull();
    expect(contractorForProject('')).toBeNull();
  });
});

describe('toSeedRows', () => {
  const draft = () => {
    const d = emptyDraft('hs');
    d.details = { contractorId: '4800001272', project: '', date: '2026-07-19', location: 'Site', inspectionNo: 'HSW-03', auditors: ['A B'] };
    d.answers = all('full', { A1: 'partial' });
    d.notes = [
      { id: '1', code: 'A1', kind: 'finding', text: ' No targets ', category: 'leadership', auto: 'documents' },
      { id: '2', code: null, kind: 'positive', text: 'Tidy', category: null, auto: null },
      { id: '3', code: null, kind: 'site', text: '   ', category: 'site', auto: 'site' },
    ];
    d.reportedScore = 0.5;
    d.fileName = 'a.xlsx';
    return d;
  };
  it('writes an audits.json row and observations.json rows', () => {
    const { audits, observations } = toSeedRows(draft(), items, secs);
    const a = audits[0];
    expect(a.id).toBe('4800001272-Q3-2026-20260719');
    expect(a).toMatchObject({ quarter: 'Q3-2026', reportedScore: 0.5, source: 'a.xlsx › Health & Safety', contractorId: '4800001272' });
    expect(a.type).toBeUndefined();
    expect(a.totalScore).toBe(Math.round(liveScore('hs', items, secs, draft().answers).total! * 10000) / 10000);
    expect(a.issues?.[0]).toMatch(/^Excel total 50% differs from \d+% computed from its own points$/);
    expect(a.sections).toHaveLength(17);
    expect(observations).toEqual([
      { id: `${a.id}-1`, auditId: a.id, itemCode: 'A1', kind: 'negative', text: 'No targets', category: 'leadership', marker: null },
      { id: `${a.id}-2`, auditId: a.id, itemCode: null, kind: 'positive', text: 'Tidy', category: null, marker: null },
    ]);
  });
  it('lists what is missing before submit', () => {
    const d = emptyDraft('hs');
    expect(missingForSubmit(d, items)).toEqual(['Pick the contractor', 'Set the audit date', `${items.length} questions unanswered`]);
    expect(missingForSubmit(draft(), items)).toEqual([]);
    expect(quarterOf('2026-12-31')).toBe('Q4-2026');
  });
});

describe('storage', () => {
  const mem = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
  };
  it('saves, replaces, lists newest first and deletes', () => {
    const s = mem();
    const a = saveDraft(emptyDraft('hs'), s)!;
    const b = saveDraft({ ...emptyDraft('crc'), savedAt: '' }, s)!;
    expect(loadSaved(s).map((x) => x.id)).toEqual([b.id, a.id]);
    saveDraft({ ...a, status: 'submitted' }, s);
    expect(loadSaved(s)).toHaveLength(2);
    expect(loadSaved(s)[0]).toMatchObject({ id: a.id, status: 'submitted' });
    expect(deleteSaved(a.id, s)).toBe(true);
    expect(loadSaved(s).map((x) => x.id)).toEqual([b.id]);
  });
  it('survives broken or blocked storage', () => {
    const bad = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); } };
    expect(loadSaved(bad)).toEqual([]);
    expect(saveDraft(emptyDraft('hs'), bad)).toBeNull();
    const junk = mem();
    junk.m.set(STORAGE_KEY, '{not json');
    expect(loadSaved(junk)).toEqual([]);
    expect(loadSaved(null)).toEqual([]);
  });
});
