import type { Repo } from './data/repo';
import { auditFindings, isFinding, isNaObservation } from './analytics';
import { CATEGORIES } from './categories';
import { QUARTERS, REGIONS, filterToQuery } from './filters';
import { itemLabel } from './itemLabels';
import type { CategoryId, Quarter, Subregion } from './types';

/**
 * The Log (/log): every observation and every audit in one searchable list, from the auditor's point of view.
 * The server builds compact plain rows (buildLog); the client filters them (filterObs / filterAuditRows) with the
 * state parsed from, and written back to, the URL (parseLogState / logStateToQuery). Finding status is the canonical
 * isFinding; findings per audit are the canonical auditFindings count.
 */

/** Finding (isFinding), Note (a negative note that is not a finding), Site (site observation), Positive. */
export type LogKind = 'finding' | 'note' | 'site' | 'positive';
export const LOG_KINDS: LogKind[] = ['finding', 'site', 'note', 'positive'];
export const KIND_LABEL: Record<LogKind, string> = { finding: 'Finding', note: 'Note', site: 'Site', positive: 'Positive' };

export type LogView = 'observations' | 'audits';
export type LogSort = 'newest' | 'oldest';

export interface LogAudit {
  id: string;
  date: string;
  quarter: Quarter;
  contractorId: string;
  contractor: string;
  region: Subregion;
  inspectionNo: string;
  location: string;
  auditors: string[];
  /** Honest total (recomputed from the Excel's own points). */
  score: number;
  /** The total typed in the Excel; shown only as a data check. */
  reported: number | null;
  findings: number;
  positives: number;
  issues: string[];
}

export interface LogObs {
  id: string;
  auditId: string;
  kind: LogKind;
  category: CategoryId | null;
  itemCode: string | null;
  /** Short question label (itemLabel); null for notes without a checklist item. */
  label: string | null;
  text: string;
  /** True when the observation has its own detail page (/category/…/<obs>); else it opens the audit report. */
  drill: boolean;
}

export interface LogData {
  audits: LogAudit[];
  observations: LogObs[];
  /** Full question per checklist code (searched, shown as a tooltip). */
  questions: Record<string, string>;
}

/** Kind of one observation in its audit. */
export function obsKind(audit: Parameters<typeof isFinding>[0], o: Parameters<typeof isFinding>[1]): LogKind {
  if (o.kind === 'positive') return 'positive';
  if (o.kind === 'site') return 'site';
  return isFinding(audit, o) ? 'finding' : 'note';
}

/** Every audit and observation of the repo as compact rows (server side). Audits newest first; observations in repo order. */
export function buildLog(repo: Repo): LogData {
  const contractors = new Map(repo.contractors().map((c) => [c.id, c]));
  const items = new Map(repo.checklist().map((i) => [i.code, i]));
  const audits = new Map(repo.audits().map((a) => [a.id, a]));
  const obsAll = repo.observations();
  const positives = new Map<string, number>();
  for (const o of obsAll) if (o.kind === 'positive') positives.set(o.auditId, (positives.get(o.auditId) ?? 0) + 1);

  const auditRows: LogAudit[] = [...audits.values()]
    .filter((a) => contractors.has(a.contractorId))
    .map((a) => {
      const c = contractors.get(a.contractorId)!;
      const findings = auditFindings(repo, a).groups.reduce((s, g) => s + g.observations.length, 0);
      return {
        id: a.id, date: a.date, quarter: a.quarter, contractorId: c.id, contractor: c.name, region: a.subregion,
        inspectionNo: a.inspectionNo, location: a.location, auditors: a.auditors, score: a.totalScore,
        reported: a.reportedScore ?? null, findings, positives: positives.get(a.id) ?? 0, issues: a.issues ?? [],
      };
    })
    .sort((x, y) => y.date.localeCompare(x.date) || x.id.localeCompare(y.id));
  const listed = new Set(auditRows.map((a) => a.id));

  const observations: LogObs[] = obsAll
    .filter((o) => listed.has(o.auditId))
    .map((o) => {
      const item = o.itemCode ? items.get(o.itemCode) : undefined;
      const drill = !!item && !!o.category && item.category === o.category && !isNaObservation(repo, o);
      return {
        id: o.id, auditId: o.auditId, kind: obsKind(audits.get(o.auditId)!, o), category: o.category, itemCode: o.itemCode,
        label: o.itemCode ? itemLabel(o.itemCode, item?.question ?? '') : null, text: o.text, drill,
      };
    });

  const questions: Record<string, string> = {};
  for (const i of repo.checklist()) questions[i.code] = i.question;
  return { audits: auditRows, observations, questions };
}

// ---------------------------------------------------------------- URL state

export interface LogState {
  view: LogView;
  search: string;
  contractor: string | null;
  categories: CategoryId[];
  kinds: LogKind[];
  quarter: Quarter | 'all';
  regions: Subregion[];
  sort: LogSort;
}

export const DEFAULT_STATE: LogState = {
  view: 'observations', search: '', contractor: null, categories: [], kinds: [], quarter: 'all', regions: [...REGIONS], sort: 'newest',
};

const list = <T extends string>(raw: string | null, allowed: readonly T[]): T[] =>
  raw ? allowed.filter((x) => raw.split(',').map((t) => t.trim()).includes(x)) : [];

/**
 * URL → state. `view`, `search`, `contractor`, `cat` and `kind` (comma lists), `sort=oldest`; quarter and regions use the
 * app-wide `q` / `r` (same rules as parseFilter, so the top bar agrees). Unknown values are dropped.
 */
export function parseLogState(sp: URLSearchParams): LogState {
  const q = sp.get('q');
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
  return {
    view: sp.get('view') === 'audits' ? 'audits' : 'observations',
    search: (sp.get('search') ?? '').slice(0, 200),
    contractor: sp.get('contractor') || null,
    categories: list(sp.get('cat'), CATEGORIES.map((c) => c.id)),
    kinds: list(sp.get('kind'), LOG_KINDS),
    quarter: q && QUARTERS.includes(q as Quarter) ? (q as Quarter) : 'all',
    regions,
    sort: sp.get('sort') === 'oldest' ? 'oldest' : 'newest',
  };
}

/** State → query string (q and r always, as filterToQuery; the rest only when not default). */
export function logStateToQuery(s: LogState): string {
  const sp = new URLSearchParams(filterToQuery({ quarter: s.quarter, regions: s.regions }));
  if (s.view !== 'observations') sp.set('view', s.view);
  if (s.search.trim()) sp.set('search', s.search.trim());
  if (s.contractor) sp.set('contractor', s.contractor);
  if (s.categories.length) sp.set('cat', s.categories.join(','));
  if (s.kinds.length) sp.set('kind', s.kinds.join(','));
  if (s.sort === 'oldest') sp.set('sort', 'oldest');
  return sp.toString();
}

/** Number of active filters other than the view and sort (search counts as one). */
export function activeFilters(s: LogState, view: LogView = s.view): number {
  return (
    (s.search.trim() ? 1 : 0) + (s.contractor ? 1 : 0) + (s.quarter !== 'all' ? 1 : 0) + (s.regions.length !== REGIONS.length ? 1 : 0) +
    (view === 'observations' ? (s.categories.length ? 1 : 0) + (s.kinds.length ? 1 : 0) : 0)
  );
}

/** Reset every filter, keeping the view. */
export const clearedState = (s: LogState): LogState => ({ ...DEFAULT_STATE, view: s.view });

// ---------------------------------------------------------------- search

/** Lower-cased, accent-free form used for matching (same length mapping is not needed: highlight re-scans the original). */
export const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Search box → distinct terms (whitespace separated, folded, longest first so highlighting prefers whole words). */
export function searchTerms(input: string): string[] {
  const seen = new Set<string>();
  for (const t of fold(input).split(/\s+/)) if (t) seen.add(t);
  return [...seen].sort((a, b) => b.length - a.length);
}

/** Every term appears in the (already folded) haystack. No terms: everything matches. */
export const matchesAll = (haystack: string, terms: string[]): boolean => terms.every((t) => haystack.includes(t));

export interface Segment { text: string; hit: boolean }

/** Split `text` into plain and matched segments (case- and accent-insensitive); adjacent/overlapping hits merge. */
export function highlight(text: string, terms: string[]): Segment[] {
  if (!terms.length || !text) return [{ text, hit: false }];
  // Fold per character so indexes in the folded string map 1:1 to the original.
  const folded = Array.from(text, (ch) => fold(ch).slice(0, 1) || ' ').join('');
  const chars = Array.from(text);
  const marks = new Array<boolean>(chars.length).fill(false);
  for (const t of terms) {
    let i = folded.indexOf(t);
    while (i !== -1) {
      for (let k = i; k < i + t.length && k < marks.length; k++) marks[k] = true;
      i = folded.indexOf(t, i + 1);
    }
  }
  const out: Segment[] = [];
  for (let k = 0; k < chars.length; k++) {
    const last = out[out.length - 1];
    if (last && last.hit === marks[k]) last.text += chars[k];
    else out.push({ text: chars[k], hit: marks[k] });
  }
  return out;
}

// ---------------------------------------------------------------- filtering

/** The searchable text of an observation: text, question (label and full), contractor, auditors, item code. */
export function obsHaystack(o: LogObs, a: LogAudit, questions: Record<string, string>): string {
  return fold([o.text, o.label ?? '', o.itemCode ? questions[o.itemCode] ?? '' : '', o.itemCode ?? '', a.contractor, a.auditors.join(' ')].join('\n'));
}

/** The searchable text of an audit: contractor, auditors, inspection no., location, contract no. (id), quarter. */
export function auditHaystack(a: LogAudit): string {
  return fold([a.contractor, a.auditors.join(' '), a.inspectionNo, a.location, a.id, a.quarter.replace('-', ' ')].join('\n'));
}

const inScope = (a: LogAudit, s: LogState) =>
  (s.quarter === 'all' || a.quarter === s.quarter) && s.regions.includes(a.region) && (!s.contractor || a.contractorId === s.contractor);

const bySort = (sort: LogSort) => (x: { date: string; id: string }, y: { date: string; id: string }) =>
  (sort === 'newest' ? y.date.localeCompare(x.date) : x.date.localeCompare(y.date)) || x.id.localeCompare(y.id, undefined, { numeric: true });

/**
 * Observations matching the state, sorted by audit date (then id). `haystacks` (same order as data.observations) can be
 * passed precomputed; otherwise it is built here.
 */
export function filterObs(data: LogData, s: LogState, haystacks?: string[]): { obs: LogObs; audit: LogAudit }[] {
  const audits = new Map(data.audits.map((a) => [a.id, a]));
  const terms = searchTerms(s.search);
  const out: { obs: LogObs; audit: LogAudit; date: string; id: string }[] = [];
  data.observations.forEach((o, i) => {
    const a = audits.get(o.auditId);
    if (!a || !inScope(a, s)) return;
    if (s.kinds.length && !s.kinds.includes(o.kind)) return;
    if (s.categories.length && (!o.category || !s.categories.includes(o.category))) return;
    if (terms.length && !matchesAll(haystacks?.[i] ?? obsHaystack(o, a, data.questions), terms)) return;
    out.push({ obs: o, audit: a, date: a.date, id: o.id });
  });
  return out.sort(bySort(s.sort)).map(({ obs, audit }) => ({ obs, audit }));
}

/** Audits matching the state (contractor, quarter, region, search), sorted by date. */
export function filterAuditRows(data: LogData, s: LogState): LogAudit[] {
  const terms = searchTerms(s.search);
  return data.audits.filter((a) => inScope(a, s) && (!terms.length || matchesAll(auditHaystack(a), terms))).sort(bySort(s.sort));
}

/** Where an observation opens: its own page when it has one, else its audit report (positives on that tab). */
export function obsHref(o: LogObs, a: LogAudit, query: string): string {
  const q = query ? `?${query}` : '';
  if (o.drill && o.category && o.itemCode) {
    return `/category/${o.category}/${a.contractorId}/${encodeURIComponent(o.itemCode)}/${encodeURIComponent(o.id)}${q}`;
  }
  const tab = o.kind === 'positive' ? `${q ? '&' : '?'}tab=positive` : '';
  return `/audit/${encodeURIComponent(o.auditId)}${q}${tab}`;
}

/** True when the Excel's typed total differs from the honest one (the data check the Audits view flags). */
export const excelDiffers = (a: LogAudit): boolean => a.issues.length > 0;
