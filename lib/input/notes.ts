import { autoCategoryFor } from './categorise';
import { uid, type AuditDraft } from './model';

/**
 * The finding note of a checklist question follows its text area exactly. The text is never trimmed or refused
 * here: a controlled text area whose stored value differs from what was typed (a leading space, a dictated word
 * with its trailing space) makes React rewrite the field mid-entry, and dictation on phones then repeats the words.
 * The note exists while the field holds anything at all and goes when it is cleared; whitespace-only notes are
 * dropped on export (toSeedRows) and never counted.
 */
export function setItemNoteText(d: AuditDraft, code: string, text: string): AuditDraft {
  const i = d.notes.findIndex((n) => n.code === code && n.kind === 'finding');
  if (i < 0) {
    if (text === '') return d;
    const auto = autoCategoryFor(d.type, code, 'finding', text);
    return { ...d, notes: [...d.notes, { id: uid('n'), code, kind: 'finding', text, category: auto, auto }] };
  }
  if (text === '') return { ...d, notes: d.notes.filter((_, j) => j !== i) };
  if (d.notes[i].text === text) return d;
  return { ...d, notes: d.notes.map((n, j) => (j === i ? { ...n, text } : n)) };
}
