import type { Filter, Quarter, Subregion } from './types';

export const QUARTERS: Quarter[] = ['Q4-2025', 'Q1-2026'];
export const REGIONS: Subregion[] = ['SR1', 'SR2'];

/** Parse `q` and `r` URL params. Absent/invalid q -> 'all'; absent/all-invalid r -> both; `r=` -> none. */
export function parseFilter(sp: URLSearchParams): Filter {
  const q = sp.get('q');
  const quarter: Filter['quarter'] = q === 'all' || QUARTERS.includes(q as Quarter) ? (q as Filter['quarter']) : 'all';
  const r = sp.get('r');
  let regions: Subregion[] = [...REGIONS];
  if (r !== null) {
    const tokens = r.split(',').map((t) => t.trim()).filter(Boolean);
    if (tokens.length === 0) regions = [];
    else {
      const valid = REGIONS.filter((x) => tokens.includes(x));
      if (valid.length) regions = valid;
    }
  }
  return { quarter, regions };
}

/** Serialise quarter + regions (never contractorId). Empty regions serialise as `r=`. */
export function filterToQuery(f: Filter): string {
  const sp = new URLSearchParams();
  sp.set('q', f.quarter);
  sp.set('r', f.regions.join(','));
  return sp.toString();
}
