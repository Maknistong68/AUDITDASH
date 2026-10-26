import { BANDS, bandFor } from './scoring';
import type { Repo } from './data/repo';
import type { Audit, Band, CategoryId, ChecklistItem, Contractor, Filter, Observation, Quarter, Subregion } from './types';
import { CATEGORIES } from './categories';
import { HAZARDS, hazardOf, isHighRisk, type HazardId, type HighRiskContractor } from './highRisk';
import { itemLabel } from './itemLabels';

const QUARTER_ORDER: Quarter[] = ['Q4-2025', 'Q1-2026'];
const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const byDate = (a: Audit, b: Audit) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id);

/** Audits matching quarter (unless overridden), regions (via contractor subregion) and optional contractorId. */
function select(repo: Repo, filter: Filter, quarter: Filter['quarter'] = filter.quarter): Audit[] {
  if (filter.type && filter.type !== 'hs') return []; // seed audits are all H&S; other types have none yet
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

/**
 * Contractors ranked by score-based gap, and the category's driving items. An item's `hits` = audits with an
 * applicable note on it (auditors annotate compliant items too, so a note is not a failure); `severity` =
 * 1 − mean official subsection score over those audits; ranked by `impact` = hits × severity.
 */
export function categoryDetail(repo: Repo, filter: Filter, cat: CategoryId): {
  contractors: { contractor: Contractor; gapRate: number; findings: number }[];
  items: { itemCode: string; question: string; hits: number; severity: number; impact: number }[];
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
    .map((i) => {
      const hit = hitsByCode.get(i.code) ?? new Set<string>();
      const ratios = audits.filter((a) => hit.has(a.id)).map((a) => itemRatio(a, i)).filter((x): x is number => x !== null);
      const severity = 1 - (mean(ratios) ?? 1);
      return { itemCode: i.code, question: i.question, hits: hit.size, severity, impact: hit.size * severity };
    })
    .filter((i) => i.hits > 0)
    .sort((a, b) => b.impact - a.impact || b.hits - a.hits || a.itemCode.localeCompare(b.itemCode, undefined, { numeric: true }));
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

export interface SystemicRepeat {
  itemCode: string; label: string; category: CategoryId; contractors: Contractor[]; contractorCount: number;
  eligibleContractors: number;
  /** The reach a question needed to count (repeatThreshold of eligibleContractors, unless given). */
  minContractors: number;
  /**
   * Audits of the eligible contractors (audited in both quarters, within the filter's regions) with an applicable note on
   * this question, per quarter: over the same audits as repeatAudits, so a per-audit rate is not skewed by contractors
   * audited in one quarter only.
   */
  q4Audits: number; q1Audits: number;
  sectionScores: { contractorId: string; q4: number | null; q1: number | null }[];
}

/**
 * The reach a question needs to count as a systemic repeat: 5 of the 7 contractors audited in both quarters (the owner's
 * rule), scaled to the contractors the filter leaves, never below 2: 7 → 5, 4 → 3, 3 → 3. Integer arithmetic.
 */
export function repeatThreshold(eligibleContractors: number): number {
  return Math.max(2, Math.ceil((5 * eligibleContractors) / 7));
}

/**
 * Questions repeated (repeatFindings) at >= minContractors contractors (default repeatThreshold of the eligible
 * contractors), i.e. noted in the contractor's latest audit and an earlier quarter. Sorted by contractorCount desc, then
 * impact (audits noted x (1 - mean subsection score)), then code.
 */
export function systemicRepeats(repo: Repo, filter: Filter, minContractors?: number): SystemicRepeat[] {
  return rankedSystemicRepeats(repo, filter, minContractors).map((r) => {
    const { impact, ...out } = r;
    void impact;
    return out;
  });
}

/** systemicRepeats with each row's ranking impact (audits noted × mean score lost); exported for tests. */
export function rankedSystemicRepeats(repo: Repo, filter: Filter, minContractors?: number): (SystemicRepeat & { impact: number })[] {
  const repeats = repeatFindings(repo, filter);
  if (!repeats.length) return [];
  const pool = select(repo, filter, 'all');
  const items = itemMap(repo);
  const quarterOf = new Map(pool.map((a) => [a.id, a.quarter]));
  const contractorOf = new Map(pool.map((a) => [a.id, a.contractorId]));
  const eligible = new Set(repeatContractors(repo, filter).map((c) => c.id));
  const eligibleContractors = eligible.size;
  const min = minContractors ?? repeatThreshold(eligibleContractors);
  const auditOf = (c: string, q: Quarter) => pool.filter((a) => a.contractorId === c && a.quarter === q).at(-1);
  const negs = itemNegatives(pool, obsByAudit(repo, pool), items);
  const byItem = new Map<string, Contractor[]>();
  for (const r of repeats) (byItem.get(r.itemCode) ?? byItem.set(r.itemCode, []).get(r.itemCode)!).push(r.contractor);
  const rows: (SystemicRepeat & { impact: number })[] = [];
  for (const [code, list] of byItem) {
    const contractors = [...new Map(list.map((c) => [c.id, c])).values()];
    const item = items.get(code);
    if (!item || contractors.length < min) continue;
    contractors.sort((a, b) => a.name.localeCompare(b.name));
    const mine = negs.filter((o) => o.itemCode === code);
    const hitIds = new Set(mine.map((o) => o.auditId));
    const auditsIn = (q: Quarter) => [...hitIds].filter((id) => quarterOf.get(id) === q && eligible.has(contractorOf.get(id)!)).length;
    const ratios = pool.filter((a) => hitIds.has(a.id)).map((a) => itemRatio(a, item)).filter((x): x is number => x !== null);
    const ratioIn = (c: string, q: Quarter) => { const a = auditOf(c, q); return a ? itemRatio(a, item) : null; };
    rows.push({
      itemCode: code, label: itemLabel(code, item.question), category: item.category, contractors, contractorCount: contractors.length,
      eligibleContractors, minContractors: min,
      q4Audits: auditsIn('Q4-2025'), q1Audits: auditsIn('Q1-2026'),
      sectionScores: contractors.map((c) => ({ contractorId: c.id, q4: ratioIn(c.id, 'Q4-2025'), q1: ratioIn(c.id, 'Q1-2026') })),
      impact: hitIds.size * (1 - (mean(ratios) ?? 1)),
    });
  }
  rows.sort((a, b) => b.contractorCount - a.contractorCount || b.impact - a.impact || a.itemCode.localeCompare(b.itemCode, undefined, { numeric: true }));
  return rows;
}

/** The contractors a systemic repeat can reach: audited in both Q4 2025 and Q1 2026 within the filter's regions. */
export function repeatContractors(repo: Repo, filter: Filter): Contractor[] {
  const pool = select(repo, filter, 'all');
  const has = (c: string, q: Quarter) => pool.some((a) => a.contractorId === c && a.quarter === q);
  return repo.contractors().filter((c) => has(c.id, 'Q4-2025') && has(c.id, 'Q1-2026'));
}

/**
 * Audits per quarter of the contractors a systemic repeat can reach (repeatContractors): the denominator of the /repeats
 * "notes per audit" rate, over the same audits as SystemicRepeat.q4Audits / q1Audits.
 */
export function repeatAudits(repo: Repo, filter: Filter): { q4: number; q1: number } {
  const eligible = new Set(repeatContractors(repo, filter).map((c) => c.id));
  const pool = select(repo, filter, 'all').filter((a) => eligible.has(a.contractorId));
  return { q4: pool.filter((a) => a.quarter === 'Q4-2025').length, q1: pool.filter((a) => a.quarter === 'Q1-2026').length };
}

/** Notes on the repeating questions per audit, per quarter (numerator and denominator over the eligible contractors' audits). */
export function repeatNotesPerAudit(rows: SystemicRepeat[], audits: { q4: number; q1: number }): { q4: number | null; q1: number | null } {
  const rate = (n: number, d: number) => (d > 0 ? n / d : null);
  return {
    q4: rate(rows.reduce((s, r) => s + r.q4Audits, 0), audits.q4),
    q1: rate(rows.reduce((s, r) => s + r.q1Audits, 0), audits.q1),
  };
}

/** How widespread systemic repeats are: questions per reach (contractors hit), widest first. */
export function repeatSpread(rows: SystemicRepeat[]): { reach: number; of: number; questions: number }[] {
  return [...new Set(rows.map((r) => r.contractorCount))]
    .sort((a, b) => b - a)
    .map((reach) => ({ reach, of: rows[0].eligibleContractors, questions: rows.filter((r) => r.contractorCount === reach).length }));
}

/** High-risk (B4/B5 items, keyword site findings) non-positive observations over filtered audits, N/A subsections excluded. */
export function highRiskCount(repo: Repo, filter: Filter): number {
  return highRiskObservations(repo, select(repo, filter)).length;
}

function highRiskObservations(repo: Repo, audits: Audit[]): Observation[] {
  const items = itemMap(repo);
  const na = new Map(audits.map((a) => [a.id, naSubsections(a)]));
  return obsByAudit(repo, audits).filter((o) => o.kind !== 'positive' && !onNaItem(o, items, na) && isHighRisk(o));
}

/**
 * The highRiskCount findings split by hazard type (lib/highRisk hazardOf): every finding in exactly one bucket, so the
 * counts sum to highRiskCount. All HAZARDS in display order, empty ones included; share is of the total (0 when none).
 */
export function highRiskByHazard(repo: Repo, filter: Filter): { hazard: HazardId; label: string; count: number; share: number }[] {
  const obs = highRiskObservations(repo, select(repo, filter));
  return HAZARDS.map((h) => {
    const count = obs.filter((o) => hazardOf(o) === h.id).length;
    return { hazard: h.id, label: h.label, count, share: obs.length ? count / obs.length : 0 };
  });
}

/** High-risk findings and audits per contractor and quarter (filter's quarter and regions), with the hazard split. */
export function highRiskByContractor(repo: Repo, filter: Filter): HighRiskContractor[] {
  const audits = select(repo, filter);
  const obs = highRiskObservations(repo, audits);
  return repo.contractors().flatMap((c) => {
    const quarters = QUARTER_ORDER.map((quarter) => {
      const mine = new Set(audits.filter((a) => a.contractorId === c.id && a.quarter === quarter).map((a) => a.id));
      const hits = obs.filter((o) => mine.has(o.auditId));
      const byHazard: Partial<Record<HazardId, number>> = {};
      for (const o of hits) byHazard[hazardOf(o)] = (byHazard[hazardOf(o)] ?? 0) + 1;
      return { quarter, audits: mine.size, findings: hits.length, byHazard };
    }).filter((q) => q.audits > 0);
    return quarters.length ? [{ id: c.id, name: c.name, quarters }] : [];
  });
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
 * items = that quarter's top 3 driving items by impact (audits noted × subsection score lost). Null when the filter has no audits.
 */
export function mainProblem(repo: Repo, filter: Filter): {
  category: CategoryId; gapRate: number; prevGapRate: number | null; quarter: Quarter;
  items: { itemCode: string; question: string; hits: number; severity: number; impact: number }[];
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

type CategoryCard = NonNullable<ReturnType<typeof mainProblem>>;

/**
 * The main-problem card's figures for any category: the same latest quarter, score-based gap, previous-quarter gap
 * and top 3 driving items as mainProblem, so mainProblem's category gives exactly the dashboard card.
 * Null when the filter has no audits or the category has no applicable item in that quarter.
 */
export function categoryCard(repo: Repo, filter: Filter, cat: CategoryId): CategoryCard | null {
  return categoryCards(repo, filter).find((c) => c.category === cat) ?? null;
}

/**
 * Every category's card (see categoryCard), worst latest-quarter gap first; ties keep the category order, so
 * card #1 is mainProblem. Categories with no applicable item in that quarter are left out. [] for an empty filter.
 */
export function categoryCards(repo: Repo, filter: Filter): CategoryCard[] {
  const audits = select(repo, filter);
  if (!audits.length) return [];
  const quarter = QUARTER_ORDER.filter((q) => audits.some((a) => a.quarter === q)).at(-1)!;
  const qf: Filter = { ...filter, quarter };
  const qi = QUARTER_ORDER.indexOf(quarter);
  const prevAudits = qi > 0 ? select(repo, filter, QUARTER_ORDER[qi - 1]) : [];
  return categoryGaps(repo, qf)
    .filter((g): g is typeof g & { gapRate: number } => g.gapRate !== null)
    .sort((a, b) => b.gapRate - a.gapRate)
    .map((g) => ({
      category: g.category,
      gapRate: g.gapRate,
      prevGapRate: prevAudits.length ? scoreGap(repo, prevAudits, g.category) : null,
      quarter,
      items: categoryDetail(repo, qf, g.category).items.slice(0, 3),
    }));
}

/**
 * "Driven by": how much of the latest quarter's lost score each category accounts for (same quarter as mainProblem).
 *
 *   weightShare(c) = mean over the quarter's audits of  W(a, c) / W(a)
 *                    W(a, c) = total weight of c's items applicable in audit a (subsection not N/A),
 *                    W(a)    = total weight of all applicable items in a  (an audit where c is N/A adds 0)
 *   contribution(c) = gapRate(c) × weightShare(c)     gapRate = the score-based gap of categoryGaps / mainProblem
 *   share(c)        = contribution(c) / Σ contribution
 *
 * So a category's share is the part of the weighted score lost through it: a big category with a moderate gap can
 * outweigh a small one with a severe gap. Categories with no applicable item (gapRate null) are left out. Sorted by
 * share desc, then gapRate desc, then category order. [] for an empty filter, a non-H&S type, or nothing lost.
 */
export function gapContribution(repo: Repo, filter: Filter): { category: CategoryId; gapRate: number; share: number }[] {
  const all = select(repo, filter);
  if (!all.length) return [];
  const quarter = QUARTER_ORDER.filter((q) => all.some((a) => a.quarter === q)).at(-1)!;
  const audits = all.filter((a) => a.quarter === quarter);
  const checklist = repo.checklist();
  const shareSum = new Map<CategoryId, number>();
  for (const a of audits) {
    const byCat = new Map<CategoryId, number>();
    let total = 0;
    for (const i of checklist) {
      if (itemRatio(a, i) === null) continue;
      total += i.weight;
      byCat.set(i.category, (byCat.get(i.category) ?? 0) + i.weight);
    }
    if (total === 0) continue;
    for (const [c, w] of byCat) shareSum.set(c, (shareSum.get(c) ?? 0) + w / total);
  }
  const rows = CATEGORIES.flatMap((c, order) => {
    const gapRate = scoreGap(repo, audits, c.id);
    if (gapRate === null) return [];
    return [{ category: c.id, gapRate, contribution: gapRate * ((shareSum.get(c.id) ?? 0) / audits.length), order }];
  });
  const sum = rows.reduce((s, r) => s + r.contribution, 0);
  if (!(sum > 0)) return [];
  return rows
    .map((r) => ({ ...r, share: r.contribution / sum }))
    .sort((a, b) => b.share - a.share || b.gapRate - a.gapRate || a.order - b.order)
    .map(({ category, gapRate, share }) => ({ category, gapRate, share }));
}

// ---------------------------------------------------------------- details pages (swipeable histories, drill levels)

/** A contractor's audits within the filter's regions, quarter filter ignored, LATEST FIRST (slide 0 = latest). */
export function contractorAudits(repo: Repo, filter: Filter, contractorId: string): { audit: Audit; previous: Audit | null }[] {
  const chrono = select(repo, { ...filter, contractorId }, 'all');
  return chrono.map((audit, i) => ({ audit, previous: i > 0 ? chrono[i - 1] : null })).reverse();
}

/** Official A/B/C section ratios of one audit (null when the section is not applicable). */
export function sectionRatios(a: Audit): { A: number | null; B: number | null; C: number | null } {
  return { A: ring(a, 'A'), B: ring(a, 'B'), C: ring(a, 'C') };
}

/** Score-based gap of each category for ONE audit, worst first; N/A categories (null) last. */
export function auditGaps(repo: Repo, audit: Audit): { category: CategoryId; gapRate: number | null; findings: number }[] {
  return gapsOver(repo, { quarter: 'all', regions: ['SR1', 'SR2'] }, [audit], null)
    .map((g) => ({ category: g.category, gapRate: g.gapRate, findings: g.findings }))
    .sort((a, b) => (b.gapRate ?? -1) - (a.gapRate ?? -1) || CATEGORIES.findIndex((c) => c.id === a.category) - CATEGORIES.findIndex((c) => c.id === b.category));
}

/**
 * An audit's findings (negative + site observations, N/A-subsection notes excluded) grouped by category,
 * groups ordered by finding count (most first), observations in id order. Also the audit's positives count.
 */
export function auditFindings(repo: Repo, audit: Audit): { groups: { category: CategoryId; observations: Observation[] }[]; positives: number } {
  const obs = obsByAudit(repo, [audit]);
  const groups = CATEGORIES.map((c) => ({ category: c.id, observations: findingsOf(repo, [audit], obs, c.id) }))
    .filter((g) => g.observations.length > 0)
    .sort((a, b) => b.observations.length - a.observations.length);
  return { groups, positives: obs.filter((o) => o.kind === 'positive').length };
}

export interface CategoryQuarter {
  quarter: Quarter;
  audits: number;
  gapRate: number | null;
  /** Gap of the chronologically previous quarter that has audits (same regions); null when none. */
  prevGapRate: number | null;
  contractors: { contractor: Contractor; gapRate: number; findings: number }[];
  items: { itemCode: string; question: string; hits: number; severity: number; impact: number }[];
}

/**
 * One entry per quarter with audits in the filter's regions (quarter filter ignored), LATEST FIRST. Items are sorted by
 * audits noted desc, then impact.
 */
export function categoryQuarters(repo: Repo, filter: Filter, cat: CategoryId): CategoryQuarter[] {
  const out: CategoryQuarter[] = [];
  let prev: number | null = null;
  for (const quarter of QUARTER_ORDER) {
    const audits = select(repo, filter, quarter);
    if (!audits.length) continue;
    const gapRate = scoreGap(repo, audits, cat);
    const { contractors, items } = categoryDetail(repo, { ...filter, quarter }, cat);
    // "Driven by" bars are audits noted: most noted first (then impact, then code), so the bars only ever get shorter.
    const byNoted = [...items].sort((a, b) => b.hits - a.hits || b.impact - a.impact || a.itemCode.localeCompare(b.itemCode, undefined, { numeric: true }));
    out.push({ quarter, audits: audits.length, gapRate, prevGapRate: prev, contractors, items: byNoted });
    prev = gapRate;
  }
  return out.reverse();
}

/**
 * Neutral item state for one audit: "noted" = an applicable auditor note on the item (not a pass/fail verdict:
 * auditors annotate compliant items too), "none" = no note, "na" = subsection scored N/A (possible 0).
 */
export type ItemState = 'noted' | 'none' | 'na';

export interface ItemInAudit {
  item: ChecklistItem;
  state: ItemState;
  observation: Observation | null;
  /** Official subsection (A items: section) score scored/possible for this audit; null when N/A. Severity = 1 − ratio. */
  ratio: number | null;
}

/** The state of each given item in one audit (one place for the items slide and the item page). */
function itemStatesIn(repo: Repo, audit: Audit, items: ChecklistItem[]): ItemInAudit[] {
  const na = naSubsections(audit);
  const negs = itemNegatives([audit], obsByAudit(repo, [audit]), itemMap(repo));
  return items.map((item) => {
    if (isNa(item, na)) return { item, state: 'na', observation: null, ratio: null };
    const o = negs.find((x) => x.itemCode === item.code) ?? null;
    return { item, state: o ? 'noted' : 'none', observation: o, ratio: itemRatio(audit, item) };
  });
}

/** The category's checklist items for one audit. */
export function auditItemStates(repo: Repo, audit: Audit, cat: CategoryId): ItemInAudit[] {
  return itemStatesIn(repo, audit, itemsOf(repo, cat));
}

/** One item across a contractor's audits (filter regions respected, quarter ignored), LATEST FIRST. */
export function itemTimeline(repo: Repo, filter: Filter, contractorId: string, item: ChecklistItem): ({ audit: Audit } & ItemInAudit)[] {
  return contractorAudits(repo, filter, contractorId).map(({ audit }) => ({ audit, ...itemStatesIn(repo, audit, [item])[0] }));
}

/** True when the observation sits on an item whose subsection is N/A in its audit (such notes are not findings). */
export function isNaObservation(repo: Repo, o: Observation): boolean {
  const audit = repo.audits().find((a) => a.id === o.auditId);
  return !!audit && onNaItem(o, itemMap(repo), new Map([[audit.id, naSubsections(audit)]]));
}

// ---------------------------------------------------------------- audit report

/** The official subsection rows of the report table, in report order (the A/B/C totals are shown as bars). */
const REPORT_SECTIONS = ['A', ...Array.from({ length: 12 }, (_, i) => `B${i + 1}`), 'C1', 'C2'];

export interface AuditReport {
  /** Chronologically previous audit of the same contractor (any region or quarter); null for a first audit. */
  previous: Audit | null;
  /** A, B1..B12, C1, C2: official possible / scored; ratio null when not applicable (possible 0). */
  sections: { code: string; label: string; possible: number; scored: number; ratio: number | null }[];
  /** Negative observations and site findings in report order, N/A-subsection notes excluded. */
  negatives: Observation[];
  positives: Observation[];
}

/** Everything the full audit report shows for one audit (the official total score is read, never recomputed). */
export function auditReport(repo: Repo, audit: Audit): AuditReport {
  const chrono = select(repo, { quarter: 'all', regions: ['SR1', 'SR2'], contractorId: audit.contractorId }, 'all');
  const i = chrono.findIndex((a) => a.id === audit.id);
  const obs = obsByAudit(repo, [audit]);
  const items = itemMap(repo);
  const na = new Map([[audit.id, naSubsections(audit)]]);
  const sections = REPORT_SECTIONS.flatMap((code) => {
    const s = audit.sections.find((x) => x.code === code);
    if (!s) return [];
    const label = code === 'A' ? 'Management' : s.label;
    return [{ code, label, possible: s.possible, scored: s.scored, ratio: s.possible > 0 ? s.scored / s.possible : null }];
  });
  return {
    previous: i > 0 ? chrono[i - 1] : null,
    sections,
    negatives: obs.filter((o) => (o.kind === 'negative' || o.kind === 'site') && !onNaItem(o, items, na)),
    positives: obs.filter((o) => o.kind === 'positive'),
  };
}
