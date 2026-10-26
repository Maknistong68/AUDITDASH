import { bandFor } from './scoring';
import type { Repo } from './data/repo';
import type { Audit, Band, CategoryId, ChecklistItem, Contractor, Filter, Observation, Quarter, Subregion } from './types';
import { CATEGORIES } from './categories';
import { isHighRisk } from './highRisk';

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
  const items = itemMap(repo);
  const na = new Map(audits.map((a) => [a.id, naSubsections(a)]));
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
    negatives: obs.filter((o) => (o.kind === 'negative' || o.kind === 'site') && !onNaItem(o, items, na)).length,
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

/** True when the observation is tied to an item whose subsection is N/A (possible === 0) in its audit. */
function onNaItem(o: Observation, items: Map<string, ChecklistItem>, na: Map<string, Set<string>>): boolean {
  const item = o.itemCode ? items.get(o.itemCode) : undefined;
  return !!item && isNa(item, na.get(o.auditId) ?? new Set());
}

/** negative/site observations of the category, excluding those on items whose subsection is N/A in that audit. */
function findingsOf(repo: Repo, audits: Audit[], obs: Observation[], cat: CategoryId): Observation[] {
  const items = itemMap(repo);
  const na = new Map(audits.map((a) => [a.id, naSubsections(a)]));
  return obs.filter((o) => {
    if ((o.kind !== 'negative' && o.kind !== 'site') || o.category !== cat) return false;
    return !onNaItem(o, items, na);
  });
}

export function categoryGaps(repo: Repo, filter: Filter): ReturnType<typeof gapsOver> {
  const prevAudits = filter.quarter === 'Q1-2026' ? select(repo, filter, 'Q4-2025') : null;
  return gapsOver(repo, filter, select(repo, filter), prevAudits);
}

/** Per-category gaps over an explicit audit set (prevAudits -> prevGapRate, null when absent). */
function gapsOver(repo: Repo, filter: Filter, audits: Audit[], prevAudits: Audit[] | null): {
  category: CategoryId; gapRate: number | null; findingRate: number | null; findings: number; prevGapRate: number | null;
}[] {
  const obs = obsByAudit(repo, audits);
  return CATEGORIES.map((c) => ({
    category: c.id,
    gapRate: scoreGap(repo, audits, c.id),
    findingRate: findingRateFor(repo, filter, audits, c.id),
    findings: findingsOf(repo, audits, obs, c.id).length,
    prevGapRate: prevAudits && prevAudits.length ? scoreGap(repo, prevAudits, c.id) : null,
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
  // at most one item per subsection key (highest impact wins; rows are already sorted)
  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    const key = items.get(r.itemCode)!.subsection ?? 'A';
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.slice(0, n);
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
  const items = itemMap(repo);
  return audits.map((audit) => {
    const item = items.get(itemCode);
    if (item && isNa(item, naSubsections(audit))) return { audit, observation: null };
    const mine = obs.filter((o) => o.auditId === audit.id);
    return { audit, observation: mine.find((o) => o.kind === 'negative') ?? mine[0] ?? null };
  });
}

// ---------------------------------------------------------------- scoreboard, repeats, high-risk, regions, compare

export interface ContractorCard {
  contractor: Contractor; auditId: string; total: number; band: Band;
  rings: { A: number | null; B: number | null; C: number | null }; previous: number | null; rank: number;
}

const ring = (a: Audit, code: string): number | null => {
  const s = a.sections.find((x) => x.code === code);
  return !s || s.possible === 0 ? null : s.scored / s.possible;
};

/** One card per contractor with a filtered audit (latest), best first; ties share a rank. */
export function contractorCards(repo: Repo, filter: Filter): ContractorCard[] {
  const audits = select(repo, filter);
  const cards: ContractorCard[] = [];
  let prevTotal: number | null = null;
  let rank = 0;
  league(repo, filter).forEach((row, i) => {
    const latest = audits.filter((a) => a.contractorId === row.contractor.id).at(-1)!;
    if (prevTotal === null || row.latest !== prevTotal) rank = i + 1;
    prevTotal = row.latest;
    cards.push({
      contractor: row.contractor, auditId: latest.id, total: latest.totalScore, band: bandFor(latest.totalScore),
      rings: { A: ring(latest, 'A'), B: ring(latest, 'B'), C: ring(latest, 'C') }, previous: row.previous, rank,
    });
  });
  return cards;
}

const BANDS: Band[] = ['Excellent', 'Good', 'Partially Compliant', 'Minimally Compliant', 'Non-Compliant'];

export function bandDistribution(repo: Repo, filter: Filter): Record<Band, number> {
  const out = Object.fromEntries(BANDS.map((b) => [b, 0])) as Record<Band, number>;
  for (const c of contractorCards(repo, filter)) out[c.band]++;
  return out;
}

/**
 * Items negative in a contractor's latest filtered audit AND in one of its audits in an earlier quarter
 * (regions respected, quarter filter ignored). N/A-subsection and null-itemCode observations excluded.
 * Worst contractor (lowest latest total) first, then itemCode.
 */
export function repeatFindings(repo: Repo, filter: Filter): {
  contractor: Contractor; itemCode: string; question: string; category: CategoryId; quarters: Quarter[];
}[] {
  if (filter.quarter === 'Q4-2025') return [];
  const audits = select(repo, filter);
  const pool = select(repo, filter, 'all');
  const items = itemMap(repo);
  const na = new Map(pool.map((a) => [a.id, naSubsections(a)]));
  const negs = repo.observations().filter((o) => o.kind === 'negative' && o.itemCode && na.has(o.auditId) && !onNaItem(o, items, na));
  const rows: { total: number; row: ReturnType<typeof repeatFindings>[number] }[] = [];
  for (const contractor of repo.contractors()) {
    const latest = audits.filter((a) => a.contractorId === contractor.id).at(-1);
    if (!latest) continue;
    const lq = QUARTER_ORDER.indexOf(latest.quarter);
    const mine = pool.filter((a) => a.contractorId === contractor.id);
    const quartersOf = new Map<string, Set<Quarter>>();
    const hitIn = (a: Audit) => negs.filter((o) => o.auditId === a.id).map((o) => o.itemCode!);
    for (const a of mine) {
      if (QUARTER_ORDER.indexOf(a.quarter) > lq) continue;
      for (const code of hitIn(a)) (quartersOf.get(code) ?? quartersOf.set(code, new Set()).get(code)!).add(a.quarter);
    }
    for (const code of new Set(hitIn(latest))) {
      const qs = quartersOf.get(code)!;
      const item = items.get(code);
      if (!item || qs.size < 2) continue;
      rows.push({
        total: latest.totalScore,
        row: { contractor, itemCode: code, question: item.question, category: item.category, quarters: QUARTER_ORDER.filter((q) => qs.has(q)) },
      });
    }
  }
  rows.sort((a, b) => a.total - b.total || a.row.itemCode.localeCompare(b.row.itemCode, undefined, { numeric: true }));
  return rows.map((r) => r.row);
}

/** High-risk (permits / keyword site) non-positive observations over filtered audits, N/A subsections excluded. */
export function highRiskCount(repo: Repo, filter: Filter): number {
  const audits = select(repo, filter);
  const items = itemMap(repo);
  const na = new Map(audits.map((a) => [a.id, naSubsections(a)]));
  return obsByAudit(repo, audits).filter((o) => o.kind !== 'positive' && !onNaItem(o, items, na) && isHighRisk(o)).length;
}

/** Average totalScore per region and quarter; ignores filter.quarter, respects regions and contractorId. */
export function regionComparison(repo: Repo, filter: Filter): { region: Subregion; byQuarter: Record<Quarter, number | null> }[] {
  return (['SR1', 'SR2'] as Subregion[])
    .filter((r) => filter.regions.includes(r))
    .map((region) => ({
      region,
      byQuarter: Object.fromEntries(
        QUARTER_ORDER.map((q) => [q, avg(select(repo, { ...filter, regions: [region] }, q))]),
      ) as Record<Quarter, number | null>,
    }));
}

export function compareContractors(repo: Repo, filter: Filter, ids: string[]): {
  card: ContractorCard; gaps: ReturnType<typeof categoryGaps>; repeats: ReturnType<typeof repeatFindings>;
}[] {
  const cards = new Map(contractorCards(repo, filter).map((c) => [c.contractor.id, c]));
  const repeats = repeatFindings(repo, filter);
  return ids
    .filter((id) => cards.has(id))
    .slice(0, 3)
    .map((id) => {
      const card = cards.get(id)!;
      // Same scope as the card's rings and total: the latest audit in the filter; prev = the audit behind `previous`.
      const latest = repo.audits().find((a) => a.id === card.auditId)!;
      const lq = QUARTER_ORDER.indexOf(latest.quarter);
      const earlier = select(repo, { ...filter, contractorId: id }, 'all').filter((a) => QUARTER_ORDER.indexOf(a.quarter) < lq);
      return {
        card,
        gaps: gapsOver(repo, { ...filter, contractorId: id }, [latest], earlier.length ? [earlier[earlier.length - 1]] : null),
        repeats: repeats.filter((r) => r.contractor.id === id),
      };
    });
}

/**
 * The quarter's main problem: worst category by score-based gap on the LATEST quarter present in the filtered
 * audits. prevGapRate = the same category's gap in the previous quarter (same regions/contractor) or null.
 * items = that quarter's top 3 driving items by audits hit. Null when the filter has no audits.
 */
export function mainProblem(repo: Repo, filter: Filter): {
  category: CategoryId; gapRate: number; prevGapRate: number | null; quarter: Quarter;
  items: { itemCode: string; question: string; hits: number }[];
} | null {
  const audits = select(repo, filter);
  if (!audits.length) return null;
  const quarter = QUARTER_ORDER.filter((q) => audits.some((a) => a.quarter === q)).at(-1)!;
  const qf: Filter = { ...filter, quarter };
  let worst: { category: CategoryId; gapRate: number } | null = null;
  for (const g of categoryGaps(repo, qf)) {
    if (g.gapRate !== null && (!worst || g.gapRate > worst.gapRate)) worst = { category: g.category, gapRate: g.gapRate };
  }
  if (!worst) return null;
  const qi = QUARTER_ORDER.indexOf(quarter);
  const prevAudits = qi > 0 ? select(repo, filter, QUARTER_ORDER[qi - 1]) : [];
  return {
    ...worst,
    prevGapRate: prevAudits.length ? scoreGap(repo, prevAudits, worst.category) : null,
    quarter,
    items: categoryDetail(repo, qf, worst.category).items.slice(0, 3),
  };
}
