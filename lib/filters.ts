import { isAuditType } from './auditTypeIds';
import meta from '../data/seed/meta.json';
import type { Filter, Quarter, Subregion } from './types';

/** Quarters that have audits in the Excel, oldest first (written by scripts/import_excel.py). */
export const QUARTERS = meta.quarters as Quarter[];
/** Sub-regions that have audits in the Excel (its sheet names), in order. */
export const REGIONS = meta.regions as Subregion[];

/** Parse `q`, `r` and `t` (audit type; absent/invalid -> hs, represented by an absent `type`) URL params. Absent/invalid q -> 'all'; absent/all-invalid r -> both; `r=` -> none. */
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
  const t = sp.get('t');
  return isAuditType(t) && t !== 'hs' ? { quarter, regions, type: t } : { quarter, regions };
}

/** Serialise quarter + regions (never contractorId). Empty regions serialise as `r=`. */
export function filterToQuery(f: Filter): string {
  const sp = new URLSearchParams();
  sp.set('q', f.quarter);
  sp.set('r', f.regions.join(','));
  if (f.type && f.type !== 'hs') sp.set('t', f.type);
  return sp.toString();
}
