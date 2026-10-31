import { describe, expect, test } from 'vitest';
import { emptyDraft } from '@/lib/input/model';
import { setItemNoteText } from '@/lib/input/notes';
import { checklistFor, sectionsFor } from '@/lib/auditTypes';
import { toSeedRows } from '@/lib/input/score';

const finding = (d: ReturnType<typeof emptyDraft>) => d.notes.find((n) => n.code === 'A1' && n.kind === 'finding');

describe('setItemNoteText keeps the text area and the draft identical (dictation on phones)', () => {
  test('a leading space creates the note and is kept exactly', () => {
    const d = setItemNoteText(emptyDraft('hs'), 'A1', ' ');
    expect(finding(d)?.text).toBe(' ');
  });

  test('every intermediate value is stored as typed: trailing spaces, double spaces, newlines', () => {
    let d = emptyDraft('hs');
    for (const t of [' ', ' No', ' No ', ' No  fire', ' No  fire\n', ' No  fire\nplan ']) {
      d = setItemNoteText(d, 'A1', t);
      expect(finding(d)?.text).toBe(t);
    }
    expect(d.notes).toHaveLength(1);
  });

  test('clearing the field removes the note; typing again makes a new one', () => {
    let d = setItemNoteText(emptyDraft('hs'), 'A1', 'x');
    const first = finding(d)!.id;
    d = setItemNoteText(d, 'A1', '');
    expect(finding(d)).toBeUndefined();
    d = setItemNoteText(d, 'A1', 'y');
    expect(finding(d)!.id).not.toBe(first);
  });

  test('an unchanged value returns the same draft (no re-render churn)', () => {
    const d = setItemNoteText(emptyDraft('hs'), 'A1', 'same');
    expect(setItemNoteText(d, 'A1', 'same')).toBe(d);
    const e = emptyDraft('hs');
    expect(setItemNoteText(e, 'A1', '')).toBe(e);
  });

  test('a whitespace-only note never reaches the export', () => {
    let d = setItemNoteText(emptyDraft('hs'), 'A1', '   ');
    d = { ...d, details: { ...d.details, contractorId: '4800001131', date: '2026-03-01' }, answers: { A1: 'no' } };
    const rows = toSeedRows(d, checklistFor('hs'), sectionsFor('hs'));
    expect(rows.observations).toHaveLength(0);
  });
});
