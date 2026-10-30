import { bandFor } from './scoring';
import type { Band, Contractor, Quarter } from './types';

/**
 * The /audits past-audits timeline (pure, client-safe): one row per contractor, its audits in date order on a time axis
 * that spans the quarters shown, a line between consecutive audits coloured by the change in whole points.
 */

export interface TimelineAudit { id: string; date: string; score: number; band: Band; quarter: Quarter }
export type Trend = 'up' | 'down' | 'flat';
export interface TimelineRow {
  id: string; name: string; region: Contractor['subregion'];
  /** Date order, oldest first. */
  audits: TimelineAudit[];
  /** One per consecutive pair of audits (audits.length − 1). */
  trends: Trend[];
  latest: number; latestBand: Band;
}

/** Change between two scores as displayed (whole points): only a real rise is 'up', only a real fall 'down'. */
export function trend(from: number, to: number): Trend {
  const d = Math.round(to * 100) - Math.round(from * 100);
  return d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
}

/** Rows for the audits given (any order), worst latest score first; ties by name. Contractors without audits are left out. */
export function timelineRows(
  audits: { id: string; contractorId: string; date: string; totalScore: number; quarter: Quarter }[],
  contractors: Contractor[],
): TimelineRow[] {
  const byId = new Map(contractors.map((c) => [c.id, c]));
  const groups = new Map<string, TimelineAudit[]>();
  for (const a of audits) {
    if (!byId.has(a.contractorId) || !Number.isFinite(a.totalScore)) continue;
    const list = groups.get(a.contractorId) ?? groups.set(a.contractorId, []).get(a.contractorId)!;
    list.push({ id: a.id, date: a.date, score: a.totalScore, band: bandFor(a.totalScore), quarter: a.quarter });
  }
  const rows: TimelineRow[] = [];
  for (const [id, list] of groups) {
    list.sort((x, y) => x.date.localeCompare(y.date) || x.id.localeCompare(y.id));
    const c = byId.get(id)!;
    const last = list.at(-1)!;
    rows.push({
      id, name: c.name, region: c.subregion, audits: list,
      trends: list.slice(1).map((a, i) => trend(list[i].score, a.score)),
      latest: last.score, latestBand: last.band,
    });
  }
  return rows.sort((a, b) => a.latest - b.latest || a.name.localeCompare(b.name));
}

/** "Q3-2026" -> [2026, 6]: year and first month (0-based). */
const quarterStart = (q: Quarter): [number, number] => [Number(q.slice(3)), (Number(q[1]) - 1) * 3];
const day = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 864e5 : NaN;
};

/** The axis: from the first day of the first quarter to the first day after the last (UTC days). */
export function timeDomain(quarters: Quarter[]): { start: number; end: number; quarters: { quarter: Quarter; from: number; to: number }[] } {
  const qs = quarters.map((quarter) => {
    const [y, m] = quarterStart(quarter);
    return { quarter, start: Date.UTC(y, m, 1) / 864e5, end: Date.UTC(y, m + 3, 1) / 864e5 };
  });
  if (!qs.length) return { start: 0, end: 1, quarters: [] };
  const start = qs[0].start;
  const end = qs.at(-1)!.end;
  return { start, end, quarters: qs.map((q) => ({ quarter: q.quarter, from: (q.start - start) / (end - start), to: (q.end - start) / (end - start) })) };
}

/** Position of a date on the axis, 0..1 (clamped; a bad date sits at 0, never NaN). */
export function xOf(date: string, domain: { start: number; end: number }): number {
  const x = (day(date) + 0.5 - domain.start) / (domain.end - domain.start);
  return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0;
}

/**
 * The months on the axis, as fractions: `x` the month's middle (where its label sits), `from`/`to` its first day and
 * the first day of the next (where it breaks), `month` 0–11, and a short name.
 */
export function monthTicks(domain: { start: number; end: number }): { x: number; from: number; to: number; month: number; label: string }[] {
  const out: { x: number; from: number; to: number; month: number; label: string }[] = [];
  const at = (t: number) => (t - domain.start) / (domain.end - domain.start);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = new Date(domain.start * 864e5);
  for (let y = d.getUTCFullYear(), m = d.getUTCMonth(); ; m++) {
    const t = Date.UTC(y, m, 1) / 864e5;
    if (t >= domain.end) break;
    const next = Date.UTC(y, m + 1, 1) / 864e5;
    const month = ((m % 12) + 12) % 12;
    out.push({ x: at((t + next) / 2), from: at(t), to: at(next), month, label: names[month] });
  }
  return out;
}

/** Band ↔ the `band=` URL value. */
export const BAND_SLUGS: Record<Band, string> = {
  Excellent: 'excellent', Good: 'good', 'Partially Compliant': 'partial', 'Minimally Compliant': 'minimal', 'Non-Compliant': 'non',
};
export function parseBand(v: string | null | undefined): Band | null {
  return (Object.entries(BAND_SLUGS).find(([, s]) => s === v)?.[0] as Band | undefined) ?? null;
}

/** Rows whose latest audit is in `band` (the band the dashboard counts them in); all rows when null. */
export function rowsInBand<T extends Pick<TimelineRow, 'latestBand'>>(rows: T[], band: Band | null): T[] {
  return band ? rows.filter((r) => r.latestBand === band) : rows;
}

/** "Abyatona (Box Culvert H55)" → base "Abyatona", qualifier "Box Culvert H55". */
export function splitName(name: string): { base: string; qual: string } {
  const m = /^(.*?)\s*\((.*)\)\s*$/.exec(name);
  return m ? { base: m[1], qual: m[2] } : { base: name, qual: '' };
}
