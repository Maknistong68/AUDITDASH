import { describe, expect, test } from 'vitest';
import { getRepo } from '@/lib/data/repo';
import { auditFindings, isFinding } from '@/lib/analytics';
import {
  DEFAULT_STATE, activeFilters, buildLog, clearedState, filterAuditRows, filterObs, highlight, logStateToQuery, matchesAll,
  obsHref, parseLogState, searchTerms, type LogState,
} from '@/lib/log';

const repo = getRepo();
const data = buildLog(repo);
const state = (s: Partial<LogState> = {}): LogState => ({ ...DEFAULT_STATE, ...s });

describe('buildLog', () => {
  test('one row per audit and per observation', () => {
    expect(data.audits).toHaveLength(repo.audits().length);
    expect(data.observations).toHaveLength(repo.observations().length);
  });
  test('audits newest first, with contractor, honest score and data checks', () => {
    for (let i = 1; i < data.audits.length; i++) expect(data.audits[i - 1].date >= data.audits[i].date).toBe(true);
    for (const row of data.audits) {
      const a = repo.audits().find((x) => x.id === row.id)!;
      expect(row.score).toBe(a.totalScore);
      expect(row.issues).toEqual(a.issues ?? []);
      expect(row.contractor).toBe(repo.contractors().find((c) => c.id === a.contractorId)!.name);
    }
  });
  test('findings and positives per audit are the canonical counts', () => {
    for (const row of data.audits) {
      const a = repo.audits().find((x) => x.id === row.id)!;
      const f = auditFindings(repo, a);
      expect(row.findings).toBe(f.groups.reduce((s, g) => s + g.observations.length, 0));
      expect(row.positives).toBe(f.positives);
    }
  });
  test('kind: finding exactly when isFinding; other negatives are notes; site and positive kept', () => {
    const audits = new Map(repo.audits().map((a) => [a.id, a]));
    const byId = new Map(repo.observations().map((o) => [o.id, o]));
    for (const row of data.observations) {
      const o = byId.get(row.id)!;
      const expected = o.kind === 'negative' ? (isFinding(audits.get(o.auditId)!, o) ? 'finding' : 'note') : o.kind;
      expect(row.kind).toBe(expected);
    }
    expect(data.observations.some((o) => o.kind === 'finding')).toBe(true);
  });
  test('only item observations with a category have their own page', () => {
    for (const o of data.observations) if (o.drill) expect(o.itemCode && o.category).toBeTruthy();
    expect(data.observations.filter((o) => !o.itemCode).every((o) => !o.drill)).toBe(true);
  });
});

describe('URL state', () => {
  test('defaults', () => {
    expect(parseLogState(new URLSearchParams())).toEqual(DEFAULT_STATE);
  });
  test('round trip', () => {
    const s = state({
      view: 'audits', search: 'fire extinguisher', contractor: '4800001134', categories: ['incident', 'site'],
      kinds: ['finding', 'site'], quarter: 'Q1-2026', regions: ['SR2'], sort: 'oldest',
    });
    expect(parseLogState(new URLSearchParams(logStateToQuery(s)))).toEqual(s);
  });
  test('unknown values dropped; empty r = no regions', () => {
    const s = parseLogState(new URLSearchParams('view=x&cat=foo,site&kind=bad&q=Q9-1999&r=&sort=x'));
    expect(s).toEqual(state({ categories: ['site'], regions: [] }));
  });
  test('defaults stay out of the query except q and r', () => {
    expect(logStateToQuery(DEFAULT_STATE)).toBe('q=all&r=SR1%2CSR2');
  });
  test('active filters and clear all keep the view', () => {
    const s = state({ view: 'audits', search: 'x', kinds: ['note'], quarter: 'Q4-2025' });
    expect(activeFilters(s)).toBe(2); // kinds do not apply to audits
    expect(activeFilters(s, 'observations')).toBe(3);
    expect(clearedState(s)).toEqual(state({ view: 'audits' }));
  });
});

describe('search', () => {
  test('terms: folded, distinct, longest first', () => {
    expect(searchTerms('  Fire  fire Exit É ')).toEqual(['fire', 'exit', 'e']);
    expect(searchTerms('')).toEqual([]);
  });
  test('all terms must match', () => {
    expect(matchesAll('fire exit blocked', ['fire', 'blocked'])).toBe(true);
    expect(matchesAll('fire exit blocked', ['fire', 'ladder'])).toBe(false);
    expect(matchesAll('anything', [])).toBe(true);
  });
  test('highlight marks every occurrence, case and accent insensitive, merging overlaps', () => {
    expect(highlight('Fire and FIRE', ['fire'])).toEqual([
      { text: 'Fire', hit: true }, { text: ' and ', hit: false }, { text: 'FIRE', hit: true },
    ]);
    expect(highlight('Café', ['cafe'])).toEqual([{ text: 'Café', hit: true }]);
    expect(highlight('abcd', ['abc', 'bcd'])).toEqual([{ text: 'abcd', hit: true }]);
    expect(highlight('plain', [])).toEqual([{ text: 'plain', hit: false }]);
    expect(highlight('ab', ['b']).map((s) => s.text).join('')).toBe('ab');
  });
});

describe('filterObs', () => {
  test('no filter: everything, newest audit first', () => {
    const rows = filterObs(data, DEFAULT_STATE);
    expect(rows).toHaveLength(data.observations.length);
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].audit.date >= rows[i].audit.date).toBe(true);
    const old = filterObs(data, state({ sort: 'oldest' }));
    expect(old[0].audit.date <= old.at(-1)!.audit.date).toBe(true);
  });
  test('filters combine: kind, category, quarter, region, contractor', () => {
    const s = state({ kinds: ['finding'], categories: ['site'], quarter: 'Q1-2026', regions: ['SR1'] });
    const rows = filterObs(data, s);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.obs.kind).toBe('finding');
      expect(r.obs.category).toBe('site');
      expect(r.audit.quarter).toBe('Q1-2026');
      expect(r.audit.region).toBe('SR1');
    }
    const c = rows[0].audit.contractorId;
    expect(filterObs(data, { ...s, contractor: c }).every((r) => r.audit.contractorId === c)).toBe(true);
    expect(filterObs(data, state({ regions: [] }))).toHaveLength(0);
  });
  test('kinds partition the observations', () => {
    const total = (['finding', 'note', 'site', 'positive'] as const).reduce((n, k) => n + filterObs(data, state({ kinds: [k] })).length, 0);
    expect(total).toBe(data.observations.length);
  });
  test('search matches text, contractor, auditors and item code', () => {
    const first = data.observations.find((o) => o.itemCode && o.kind === 'finding')!;
    const a = data.audits.find((x) => x.id === first.auditId)!;
    const word = first.text.split(/\s+/).find((w) => w.length > 6)!;
    expect(filterObs(data, state({ search: word })).some((r) => r.obs.id === first.id)).toBe(true);
    const byContractor = filterObs(data, state({ search: a.contractor }));
    expect(byContractor.length).toBeGreaterThan(0);
    // An auditor's name finds every observation of the audits they did.
    const ids = new Set(filterObs(data, state({ search: a.auditors[0] })).map((r) => r.obs.id));
    for (const o of data.observations.filter((x) => x.auditId === a.id)) expect(ids.has(o.id)).toBe(true);
    expect(filterObs(data, state({ search: first.itemCode! })).some((r) => r.obs.id === first.id)).toBe(true);
    expect(filterObs(data, state({ search: 'zzqqxx-no-such-thing' }))).toHaveLength(0);
  });
});

describe('filterAuditRows', () => {
  test('quarter, region, contractor and search', () => {
    expect(filterAuditRows(data, DEFAULT_STATE)).toHaveLength(data.audits.length);
    for (const a of filterAuditRows(data, state({ quarter: 'Q4-2025', regions: ['SR2'] }))) {
      expect(a.quarter).toBe('Q4-2025');
      expect(a.region).toBe('SR2');
    }
    const a = data.audits[0];
    expect(filterAuditRows(data, state({ search: a.inspectionNo })).some((x) => x.id === a.id)).toBe(true);
    expect(filterAuditRows(data, state({ contractor: a.contractorId })).every((x) => x.contractorId === a.contractorId)).toBe(true);
  });
});

describe('obsHref', () => {
  const audits = new Map(data.audits.map((a) => [a.id, a]));
  test('drillable observation opens its own page', () => {
    const o = data.observations.find((x) => x.drill)!;
    const a = audits.get(o.auditId)!;
    expect(obsHref(o, a, 'q=all')).toBe(`/category/${o.category}/${a.contractorId}/${encodeURIComponent(o.itemCode!)}/${encodeURIComponent(o.id)}?q=all`);
  });
  test('others open the audit report; positives on their tab', () => {
    const p = data.observations.find((x) => x.kind === 'positive' && !x.drill)!;
    expect(obsHref(p, audits.get(p.auditId)!, 'q=all')).toBe(`/audit/${encodeURIComponent(p.auditId)}?q=all&tab=positive`);
    const s = data.observations.find((x) => x.kind === 'site')!;
    expect(obsHref(s, audits.get(s.auditId)!, '')).toBe(`/audit/${encodeURIComponent(s.auditId)}`);
  });
});
