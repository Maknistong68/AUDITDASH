import { unzipSync } from 'fflate';

/**
 * A minimal, read-only .xlsx reader for the browser (and node tests): an .xlsx is a zip of XML parts.
 * Only the parts needed to read cell values are unzipped (workbook, its rels, shared strings, the one sheet);
 * pictures (`xl/media/*`, drawings, rich data) are never inflated. Cached `<v>` values are used as typed;
 * formulas are never evaluated.
 *
 * The XML is read with a small tag scanner instead of DOMParser so the same code runs in the browser and in the
 * vitest node environment; SpreadsheetML parts are machine-written and flat enough for it (no CDATA, no comments
 * inside cells).
 */

export type CellValue = string | number | boolean | null;

export interface Sheet {
  name: string;
  /** Cell value by A1 reference ("B2"); absent = empty. Error cells (`#VALUE!`) read as their error text. */
  cells: Map<string, CellValue>;
  /** Highest row number with any value. */
  maxRow: number;
}

export interface Workbook {
  sheetNames: string[];
  sheet(name: string): Sheet | null;
}

const DEC = new TextDecoder('utf-8');

const ENTITY: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** XML entities, then OOXML's `_xHHHH_` escapes (e.g. `_x000D_` for a carriage return). */
export function decodeXml(s: string): string {
  return s
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) =>
      e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITY[e.toLowerCase()],
    )
    .replace(/_x([0-9A-Fa-f]{4})_/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

/** Attributes of one start tag's text (`<c r="B2" t="s">` -> {r: "B2", t: "s"}). Namespace prefixes are kept. */
export function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) out[m[1]] = decodeXml(m[3] ?? m[4] ?? '');
  return out;
}

/** Each `<name ...>inner</name>` or `<name .../>` element (non-nested occurrences of `name`). */
function* elements(xml: string, name: string): Generator<{ tag: string; inner: string }> {
  const re = new RegExp(`<${name}(?=[\\s/>])([^>]*?)(/>|>([\\s\\S]*?)</${name}>)`, 'g');
  for (const m of xml.matchAll(re)) yield { tag: m[1], inner: m[3] ?? '' };
}

/** Concatenated `<t>` text of a shared string or inline string, phonetic runs (`<rPh>`) left out. */
function textOf(inner: string): string {
  const body = inner.replace(/<rPh[\s\S]*?<\/rPh>/g, '');
  let s = '';
  for (const t of elements(body, 't')) s += decodeXml(t.inner);
  return s;
}

/** "B12" -> {col: 2, row: 12}; "AA3" -> {col: 27, row: 3}. */
export function splitRef(ref: string): { col: number; row: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!m) return { col: 0, row: 0 };
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col, row: Number(m[2]) };
}

/** Excel serial date (1900 system) -> "YYYY-MM-DD". Day 60 is Excel's phantom 29 Feb 1900; serials after it line up with 1899-12-30. */
export function excelSerialToIso(serial: number): string {
  const ms = Math.round((Math.floor(serial) - 25569) * 86400000); // 25569 = 1970-01-01
  return new Date(ms).toISOString().slice(0, 10);
}

/** Path of a relationship target relative to `xl/` ("worksheets/sheet1.xml", or "/xl/worksheets/sheet1.xml"). */
function resolve(target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = ['xl'];
  for (const p of target.split('/')) {
    if (p === '..') parts.pop();
    else if (p && p !== '.') parts.push(p);
  }
  return parts.join('/');
}

function parseSheet(name: string, xml: string, shared: string[]): Sheet {
  const cells = new Map<string, CellValue>();
  let maxRow = 0;
  const data = /<sheetData[^>]*>([\s\S]*?)<\/sheetData>/.exec(xml)?.[1] ?? '';
  for (const c of elements(data, 'c')) {
    const a = attrs(c.tag);
    const ref = a.r;
    if (!ref) continue;
    const t = a.t ?? 'n';
    let value: CellValue = null;
    if (t === 'inlineStr') {
      const is = /<is>([\s\S]*?)<\/is>/.exec(c.inner)?.[1];
      value = is === undefined ? null : textOf(is);
    } else {
      const v = /<v>([\s\S]*?)<\/v>/.exec(c.inner)?.[1];
      if (v === undefined) continue;
      if (t === 's') value = shared[Number(v)] ?? null;
      else if (t === 'str' || t === 'e') value = decodeXml(v);
      else if (t === 'b') value = v === '1';
      else {
        const n = Number(v);
        value = Number.isFinite(n) ? n : decodeXml(v);
      }
    }
    if (value === null || value === '') continue;
    cells.set(ref, value);
    maxRow = Math.max(maxRow, splitRef(ref).row);
  }
  return { name, cells, maxRow };
}

/**
 * Open an .xlsx from its bytes. Throws a readable Error when the file is not an .xlsx workbook.
 * Only XML parts under `xl/` that hold cell data are inflated; `xl/media/*` (photos) is skipped by the unzip filter.
 */
export function readWorkbook(bytes: Uint8Array): Workbook {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (f) =>
        !f.name.startsWith('xl/media/') &&
        (f.name === 'xl/workbook.xml' || f.name === 'xl/_rels/workbook.xml.rels' || f.name === 'xl/sharedStrings.xml' || /^xl\/worksheets\/[^/]+\.xml$/.test(f.name)),
    });
  } catch {
    throw new Error('This file is not an Excel workbook (.xlsx).');
  }
  const text = (path: string) => (files[path] ? DEC.decode(files[path]) : null);
  const wb = text('xl/workbook.xml');
  if (!wb) throw new Error('This file is not an Excel workbook (.xlsx).');
  const rels = new Map<string, string>();
  for (const r of elements(text('xl/_rels/workbook.xml.rels') ?? '', 'Relationship')) {
    const a = attrs(r.tag);
    if (a.Id && a.Target) rels.set(a.Id, resolve(a.Target));
  }
  const sheets: { name: string; path: string }[] = [];
  for (const s of elements(wb, 'sheet')) {
    const a = attrs(s.tag);
    const rid = a['r:id'] ?? Object.entries(a).find(([k]) => k.endsWith(':id'))?.[1];
    const path = rid ? rels.get(rid) : undefined;
    if (a.name && path) sheets.push({ name: a.name, path });
  }
  const shared: string[] = [];
  for (const si of elements(text('xl/sharedStrings.xml') ?? '', 'si')) shared.push(textOf(si.inner));
  const cache = new Map<string, Sheet>();
  return {
    sheetNames: sheets.map((s) => s.name),
    sheet(name) {
      const hit = sheets.find((s) => s.name === name) ?? sheets.find((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase());
      if (!hit) return null;
      if (!cache.has(hit.name)) {
        const xml = text(hit.path);
        if (!xml) return null;
        cache.set(hit.name, parseSheet(hit.name, xml, shared));
      }
      return cache.get(hit.name)!;
    },
  };
}

/** Cell value at column letter + row (`cell(sheet, 'B', 12)`). */
export const cell = (s: Sheet, col: string, row: number): CellValue => s.cells.get(`${col}${row}`) ?? null;
