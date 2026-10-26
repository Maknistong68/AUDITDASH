import { CATEGORIES } from './categories';
import type { Repo } from './data/repo';
import type { CategoryId, ChecklistItem, Contractor } from './types';

export function findCategory(id: string): CategoryId | null {
  return CATEGORIES.some((c) => c.id === id) ? (id as CategoryId) : null;
}
export function findContractor(repo: Repo, id: string): Contractor | null {
  return repo.contractors().find((c) => c.id === id) ?? null;
}
/** decodeURIComponent that never throws (a malformed escape is just an unknown id -> 404). */
export function safeDecode(v: string): string {
  try { return decodeURIComponent(v); } catch { return v; }
}

/** A checklist item that belongs to the category (route param is URL-decoded first). */
export function findItem(repo: Repo, cat: CategoryId, code: string): ChecklistItem | null {
  const c = safeDecode(code);
  return repo.checklist().find((i) => i.code === c && i.category === cat) ?? null;
}
