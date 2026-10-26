import { bandFor } from './scoring';
import type { Repo } from './data/repo';
import type { Audit, Band, CategoryId, ChecklistItem, Contractor, Filter, Observation, Quarter } from './types';
import { CATEGORIES } from './categories';

const QUARTER_ORDER: Quarter[] = ['Q4-2025', 'Q1-2026'];
const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const byDate = (a: Audit, b: Audit) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id);

/** Audits matching quarter (unless overridden), regions (via contractor subregion) and optional contractorId. */
function select(repo: Repo, filter: Filter, quarter: Filter['quarter'] = filter.quarter): Audit[] {
  const region = new Map(repo.contractors().map((c) => [c.id, c.subregion]));
  return repo
    .audits()
    .filter((a) => {
      if (quarter !== 'all' && a.quarter !== quarter) return false;
      const r = region.get(a.contractorId);
      if (!r || !filter.regions.includes(r)) return false;
      return !filter.contractorId || a.contractorId === filter.contractorId;
    })
    .sort(byDate);
}

export function filterAudits(repo: Repo, filter: Filter): Audit[] {
  return select(repo, filter);
}

function obsByAudit(repo: Repo, audits: Audit[]): Observation[] {
  const ids = new Set(audits.map((a) => a.id));
  return repo.observations().filter((o) => ids.has(o.auditId));
}

const avg = (audits: Audit[]) => mean(audits.map((a) => a.totalScore));

export function portfolioSummary(repo: Repo, filter: Filter): {
  avgScore: number | null; band: Band | null; delta: number | null; audits: number; negatives: number; positives: number;
} {
  const audits = select(repo, filter);
  const avgScore = avg(audits);
  const obs = obsByAudit(repo, audits);
  let delta: number | null = null;
  if (filter.quarter === 'Q1-2026' || filter.quarter === 'all') {
    const q1 = avg(select(repo, filter, 'Q1-2026'));
    const q4 = avg(select(repo, filter, 'Q4-2025'));
    if (q1 !== null && q4 !== null) delta = q1 - q4;
  }
  return {
    avgScore,
    band: avgScore === null ? null : bandFor(avgScore),
    delta,
    audits: audits.length,
    negatives: obs.filter((o) => o.kind === 'negative' || o.kind === 'site').length,
    positives: obs.filter((o) => o.kind === 'positive').length,
  };
}

/** Per-audit set of subsection codes scored N/A (possible === 0). */
function naSubsections(a: Audit): Set<string> {
  return new Set(a.sections.filter((s) => s.possible === 0).map((s) => s.code));
}

function itemsOf(repo: Repo, cat: CategoryId): ChecklistItem[] {
  return repo.checklist().filter((i) => i.category === cat);
}

const isNa = (item: ChecklistItem, na: Set<string>) => na.has(item.subsection ?? item.section);

/** Official section ratio scored/possible for the item's subsection (section for A items); null = not applicable. */
function itemRatio(a: Audit, item: ChecklistItem): number | null {
  const code = item.subsection ?? item.section;
  const sec = a.sections.find((x) => x.code === code);
  return !sec || sec.possible === 0 ? null : sec.scored / sec.possible;
}

/** Weighted compliance of one audit over a category's applicable items; null if none applicable. */
export function auditCompliance(a: Audit, items: ChecklistItem[]): number | null {
  let w = 0;
  let wv = 0;
  for (const i of items) {
    const r = itemRatio(a, i);
    if (r === null) continue;
    w += i.weight;
    wv += i.weight * r;
  }
  return w === 0 ? null : wv / w;
}

/** Score-based gap = 1 - mean compliance over audits with an applicable item; null if none. */
function scoreGap(repo: Repo, audits: Audit[], cat: CategoryId): number | null {
  const items = itemsOf(repo, cat);
  const m = mean(audits.map((a) => auditCompliance(a, items)).filter((x): x is number => x !== null));
  return m === null ? null : 1 - m;
}

/** Applicable item-slots for a category over the filtered audits (items x audits minus N/A subsections). */
export function applicableSlots(repo: Repo, filter: Filter, cat: CategoryId, audits: Audit[] = select(repo, filter)): number {
  const items = itemsOf(repo, cat);
  let n = 0;
  for (const a of audits) {
    const na = naSubsections(a);
    for (const i of items) if (!isNa(i, na)) n++;
  }
  return n;
}

/**
 * Item-level negative observations (itemCode set) that sit on an applicable slot. The seed contains
 * "N/A - ..." notes imported as negatives on subsections scored possible === 0 (e.g. B5); they are not gaps.
 */
function itemNegatives(audits: Audit[], obs: Observation[], items: Map<string, ChecklistItem>): Observation[] {
  const na = new Map(audits.map((a) => [a.id, naSubsections(a)]));
  return obs.filter((o) => {
    if (o.kind !== 'negative' || !o.itemCode) return false;
    const item = items.get(o.itemCode);
    return !!item && !isNa(item, na.get(o.auditId) ?? new Set());
  });
}
const itemMap = (repo: Repo) => new Map(repo.checklist().map((i) => [i.code, i]));

/** Distinct (audit, itemCode) negative hits among the audits' observations for the category's items. */
function itemHits(repo: Repo, audits: Audit[], cat: CategoryId, obs = obsByAudit(repo, audits)): number {
  const codes = new Set(itemsOf(repo, cat).map((i) => i.code));
  const seen = new Set<string>();
  for (const o of itemNegatives(audits, obs, itemMap(repo))) if (codes.has(o.itemCode!)) seen.add(`${o.auditId}|${o.itemCode}`);
  return seen.size;
}

function findingRateFor(repo: Repo, filter: Filter, audits: Audit[], cat: CategoryId): number | null {
  const slots = applicableSlots(repo, filter, cat, audits);
  return slots === 0 ? null : itemHits(repo, audits, cat) / slots;
}

/** negative/site observations of the category, excluding those on items whose subsection is N/A in that audit. */
function findingsOf(repo: Repo, audits: Audit[], obs: Observation[], cat: CategoryId): Observation[] {
  const items = itemMap(repo);
  const na = new Map(audits.map((a) => [a.id, naSubsections(a)]));
  return obs.filter((o) => {
    if ((o.kind !== 'negative' && o.kind !== 'site') || o.category !== cat) return false;
    const item = o.itemCode ? items.get(o.itemCode) : undefined;
    return !(item && isNa(item, na.get(o.auditId) ?? new Set()));
  });
}

export function categoryGaps(repo: Repo, filter: Filter): {
  category: CategoryId; gapRate: number | null; findingRate: number | null; findings: number; prevGapRate: number | null;
}[] {
  const audits = select(repo, filter);
  const obs = obsByAudit(repo, audits);
  const prevAudits = filter.quarter === 'Q1-2026' ? select(repo, filter, 'Q4-2025') : null;
  return CATEGORIES.map((c) => ({
    category: c.id,
    gapRate: scoreGap(repo, audits, c.id),
    findingRate: findingRateFor(repo, filter, audits, c.id),
    findings: findingsOf(repo, audits, obs, c.id).length,
    prevGapRate: prevAudits ? scoreGap(repo, prevAudits, c.id) : null,
  }));
}

export function league(repo: Repo, filter: Filter): { contractor: Contractor; latest: number; previous: number | null }[] {
  const audits = select(repo, filter);
  // regions (and contractor) respected, quarter filter ignored, for the "previous" lookup
  const pool = select(repo, filter, 'all');
  const rows: { contractor: Contractor; latest: number; previous: number | null }[] = [];
  for (const contractor of repo.contractors()) {
    const mine = audits.filter((a) => a.contractorId === contractor.id);
    if (!mine.length) continue;
    const latestAudit = mine[mine.length - 1];
    const lq = QUARTER_ORDER.indexOf(latestAudit.quarter);
    const earlier = pool.filter((a) => a.contractorId === contractor.id && QUARTER_ORDER.indexOf(a.quarter) < lq);
    rows.push({
      contractor,
      latest: latestAudit.totalScore,
      previous: earlier.length ? earlier[earlier.length - 1].totalScore : null,
    });
  }
  return rows.sort((a, b) => b.latest - a.latest || a.contractor.name.localeCompare(b.contractor.name));
}

export function topIssues(repo: Repo, filter: Filter, n = 6): {
  itemCode: string; question: string; category: CategoryId; auditsHit: number; auditsTotal: number; impact: number; byQuarter: Record<Quarter, number>;
}[] {
  const audits = select(repo, filter);
  const quarterOf = new Map(audits.map((a) => [a.id, a.quarter]));
  const hits = new Map<string, Set<string>>();
  for (const o of itemNegatives(audits, obsByAudit(repo, audits), itemMap(repo))) {
    const s = hits.get(o.itemCode!) ?? new Set<string>();
    s.add(o.auditId);
    hits.set(o.itemCode!, s);
  }
  const items = new Map(repo.checklist().map((i) => [i.code, i]));
  const rows = [...hits.entries()].flatMap(([code, set]) => {
    const item = items.get(code);
    if (!item) return [];
    const byQuarter: Record<Quarter, number> = { 'Q4-2025': 0, 'Q1-2026': 0 };
    for (const id of set) byQuarter[quarterOf.get(id)!]++;
    const ratios = audits.filter((a) => set.has(a.id)).map((a) => itemRatio(a, item)).filter((x): x is number => x !== null);
    const impact = set.size * (1 - (mean(ratios) ?? 1));
    return [{ itemCode: code, question: item.question, category: item.category, auditsHit: set.size, auditsTotal: audits.length, impact, byQuarter }];
  });
  rows.sort((a, b) => b.impact - a.impact || b.auditsHit - a.auditsHit || a.itemCode.localeCompare(b.itemCode, undefined, { numeric: true }));
  return rows.slice(0, n);
}

export function categoryDetail(repo: Repo, filter: Filter, cat: CategoryId): {
  contractors: { contractor: Contractor; gapRate: number; findings: number }[];
  items: { itemCode: string; question: string; hits: number }[];
} {
  const audits = select(repo, filter);
  const obs = obsByAudit(repo, audits);
  const contractors: { contractor: Contractor; gapRate: number; findings: number }[] = [];
  for (const contractor of repo.contractors()) {
    const mine = audits.filter((a) => a.contractorId === contractor.id);
    if (!mine.length) continue;
    const gapRate = scoreGap(repo, mine, cat);
    if (gapRate === null) continue;
    const mineIds = new Set(mine.map((a) => a.id));
    contractors.push({ contractor, gapRate, findings: findingsOf(repo, mine, obs.filter((o) => mineIds.has(o.auditId)), cat).length });
  }
  contractors.sort((a, b) => b.gapRate - a.gapRate || a.contractor.name.localeCompare(b.contractor.name));
  const hitsByCode = new Map<string, Set<string>>();
  for (const o of itemNegatives(audits, obs, itemMap(repo))) {
    (hitsByCode.get(o.itemCode!) ?? hitsByCode.set(o.itemCode!, new Set()).get(o.itemCode!)!).add(o.auditId);
  }
  const items = itemsOf(repo, cat)
    .map((i) => ({ itemCode: i.code, question: i.question, hits: hitsByCode.get(i.code)?.size ?? 0 }))
    .filter((i) => i.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.itemCode.localeCompare(b.itemCode, undefined, { numeric: true }));
  return { contractors, items };
}

export function contractorInCategory(repo: Repo, filter: Filter, cat: CategoryId, contractorId: string): {
  audits: Audit[]; items: { item: ChecklistItem; hitsByAudit: Record<string, Observation | null> }[];
} {
  const audits = select(repo, { ...filter, contractorId });
  const obs = itemNegatives(audits, obsByAudit(repo, audits), itemMap(repo));
  const items = itemsOf(repo, cat).map((item) => {
    const hitsByAudit: Record<string, Observation | null> = {};
    for (const a of audits) {
      hitsByAudit[a.id] = obs.find((o) => o.auditId === a.id && o.itemCode === item.code) ?? null;
    }
    return { item, hitsByAudit };
  });
  return { audits, items };
}

/** All of a contractor's audits (chronological) with the observation on this item, if any (negative preferred). */
export function itemHistory(repo: Repo, contractorId: string, itemCode: string): { audit: Audit; observation: Observation | null }[] {
  const audits = repo.audits().filter((a) => a.contractorId === contractorId).sort(byDate);
  const obs = repo.observations().filter((o) => o.itemCode === itemCode);
  return audits.map((audit) => {
    const mine = obs.filter((o) => o.auditId === audit.id);
    return { audit, observation: mine.find((o) => o.kind === 'negative') ?? mine[0] ?? null };
  });
}
