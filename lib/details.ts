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

/**
 * `path?query` plus an optional slide index and hash. Slide 0 is omitted unless the query names a quarter
 * (an absent `s` then opens the details on that quarter, so an explicit latest slide must say `s=0`).
 */
export function href(path: string, query: string, opts: { s?: number; hash?: string } = {}): string {
  const q = new URLSearchParams(query).get('q');
  const explicitZero = opts.s === 0 && q !== null && q !== 'all';
  const s = opts.s !== undefined && (opts.s > 0 || explicitZero) ? `&s=${opts.s}` : '';
  return `${path}?${query}${s}${opts.hash ? `#${opts.hash}` : ''}`;
}

/**
 * Where a repeat-finding row leads: the item page when one contractor repeats the item, else the item inside
 * the category view (`#item-<code>` is the anchor on the category slide).
 */
export function repeatHref(category: string, itemCode: string, contractorIds: readonly string[], query: string): string {
  return contractorIds.length === 1
    ? href(`/category/${category}/${contractorIds[0]}/${encodeURIComponent(itemCode)}`, query)
    : href(`/category/${category}`, query, { hash: `item-${itemCode}` });
}
