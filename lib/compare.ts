/** Compare-mode selection: lives in the URL as `c=<id,id,id>` (max 3, order kept). Pure helpers. */
export const MAX_COMPARE = 3;

/** Valid, de-duplicated ids from the `c` param, in URL order, capped at MAX_COMPARE. */
export function parseCompare(raw: string | null | undefined, validIds: readonly string[]): string[] {
  if (!raw) return [];
  const valid = new Set(validIds);
  const out: string[] = [];
  for (const t of raw.split(',').map((s) => s.trim())) {
    if (t && valid.has(t) && !out.includes(t)) out.push(t);
    if (out.length === MAX_COMPARE) break;
  }
  return out;
}

/** Adds or removes `id`; a 4th id is refused (selection unchanged). */
export function toggleCompare(selected: readonly string[], id: string): string[] {
  if (selected.includes(id)) return selected.filter((x) => x !== id);
  return selected.length >= MAX_COMPARE ? [...selected] : [...selected, id];
}

/** Returns `search` with `c` set to `ids` (or removed when empty); other params are kept. */
export function withCompare(search: string, ids: readonly string[]): string {
  const sp = new URLSearchParams(search);
  if (ids.length) sp.set('c', ids.join(','));
  else sp.delete('c');
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Index of the lowest (best) and highest (worst) gap among non-null values; -1 when < 2 values or all equal. */
export function bestWorst(values: readonly (number | null)[]): { best: number; worst: number } {
  let best = -1;
  let worst = -1;
  values.forEach((v, i) => {
    if (v === null || !Number.isFinite(v)) return;
    if (best === -1 || v < values[best]!) best = i;
    if (worst === -1 || v > values[worst]!) worst = i;
  });
  const n = values.filter((v) => v !== null && Number.isFinite(v)).length;
  if (n < 2 || best === -1 || values[best] === values[worst]) return { best: -1, worst: -1 };
  return { best, worst };
}
