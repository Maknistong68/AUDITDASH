import type { AuditDraft } from './model';

/**
 * Drafts and submitted audits live only in this browser's localStorage (no backend yet). Every access is guarded:
 * private windows, blocked site data and quota errors read as "nothing saved" and never break the page.
 */
export const STORAGE_KEY = 'audit-input:v1';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function store(): Store | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

const isDraft = (x: unknown): x is AuditDraft =>
  !!x && typeof x === 'object' && typeof (x as AuditDraft).id === 'string' && typeof (x as AuditDraft).answers === 'object' && Array.isArray((x as AuditDraft).notes);

/** Saved audits, newest first. */
export function loadSaved(s: Store | null = store()): AuditDraft[] {
  try {
    const raw = s?.getItem(STORAGE_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(isDraft).sort((a, b) => b.savedAt.localeCompare(a.savedAt)) : [];
  } catch {
    return [];
  }
}

function write(list: AuditDraft[], s: Store | null): boolean {
  try {
    if (!s) return false;
    s.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** Insert or replace by id, stamping savedAt. Returns the saved copy, or null when the browser refused. */
export function saveDraft(d: AuditDraft, s: Store | null = store()): AuditDraft | null {
  const next = { ...d, savedAt: new Date().toISOString() };
  const list = loadSaved(s).filter((x) => x.id !== d.id);
  return write([next, ...list], s) ? next : null;
}

export function deleteSaved(id: string, s: Store | null = store()): boolean {
  return write(loadSaved(s).filter((x) => x.id !== id), s);
}
