import { filterToQuery, parseFilter } from './filters';
import type { Filter } from './types';

export type SP = Record<string, string | string[] | undefined>;

/** Next searchParams record -> URLSearchParams (first value of repeated keys). */
export function toSearchParams(sp: SP): URLSearchParams {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') out.set(k, v);
    else if (Array.isArray(v) && v.length) out.set(k, v[0]);
  }
  return out;
}

/** Filter + its serialised query for a details page. */
export function detailContext(sp: SP): { filter: Filter; query: string; s: string | null } {
  const params = toSearchParams(sp);
  const filter = parseFilter(params);
  return { filter, query: filterToQuery(filter), s: params.get('s') };
}

/** `path?query` plus an optional slide index (omitted for 0) and hash. */
export function href(path: string, query: string, opts: { s?: number; hash?: string } = {}): string {
  const s = opts.s && opts.s > 0 ? `&s=${opts.s}` : '';
  return `${path}?${query}${s}${opts.hash ? `#${opts.hash}` : ''}`;
}
