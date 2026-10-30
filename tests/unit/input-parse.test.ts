import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { checklistFor } from '@/lib/auditTypes';
import { draftFromParsed, isNaNote, labelKind, parseHsWorkbook, subsectionOf, toCompliance, toIsoDate } from '@/lib/input/parse';
import { emptyDraft } from '@/lib/input/model';
import { decodeXml, excelSerialToIso, readWorkbook, splitRef } from '@/lib/input/xlsx';
import type { ChecklistItem } from '@/lib/types';

const items = checklistFor('hs') as unknown as ChecklistItem[];

/** A tiny synthetic H&S checklist workbook: cells given as {ref: value}; strings go to sharedStrings except `str:`/`inline:` prefixes. */
function buildXlsx(cells: Record<string, string | number>, opts: { sheetName?: string; media?: boolean } = {}): Uint8Array {
  const shared: string[] = [];
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const byRow = new Map<number, string[]>();
  for (const [ref, v] of Object.entries(cells)) {
    const row = splitRef(ref).row;
    let xml: string;
    if (typeof v === 'number') xml = `<c r="${ref}" s="1"><v>${v}</v></c>`;
    else if (v.startsWith('str:')) xml = `<c r="${ref}" t="str"><f>A1</f><v>${esc(v.slice(4))}</v></c>`;
    else if (v.startsWith('inline:')) xml = `<c r="${ref}" t="inlineStr"><is><t>${esc(v.slice(7))}</t></is></c>`;
    else if (v.startsWith('err:')) xml = `<c r="${ref}" t="e" vm="1"><v>${esc(v.slice(4))}</v></c>`;
    else { shared.push(v); xml = `<c r="${ref}" t="s"><v>${shared.length - 1}</v></c>`; }
    byRow.set(row, [...(byRow.get(row) ?? []), xml]);
  }
  const rows = [...byRow.entries()].sort((a, b) => a[0] - b[0]).map(([r, cs]) => `<row r="${r}">${cs.join('')}</row>`).join('');
  const name = opts.sheetName ?? 'Health &amp; Safety';
  const files: Record<string, Uint8Array> = {
    'xl/workbook.xml': strToU8(`<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Cover" sheetId="1" r:id="rId2"/><sheet name="${name}" sheetId="2" r:id="rId1"/></sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="ws" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="ws" Target="/xl/worksheets/sheet2.xml"/></Relationships>`),
    'xl/sharedStrings.xml': strToU8(`<?xml version="1.0"?><sst>${shared.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join('')}</sst>`),
    'xl/worksheets/sheet1.xml': strToU8(`<?xml version="1.0"?><worksheet><cols><col min="1" max="2"/></cols><sheetData>${rows}</sheetData></worksheet>`),
    'xl/worksheets/sheet2.xml': strToU8(`<?xml version="1.0"?><worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><r><t>Co</t></r><r><t>ver</t></r><rPh><t>x</t></rPh></is></c></row></sheetData></worksheet>`),
  };
  if (opts.media) files['xl/media/image1.png'] = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
  return zipSync(files);
}

const FIXTURE: Record<string, string | number> = {
  B2: ' Project:', D2: 'AL FAHD-4800001272', G2: ' Date:', H2: 46222,
  B3: ' Location:', D3: 'Sub Region 2  -  Coast Guard', G3: ' Inspection No.:', H3: ' HSW-03',
  B4: ' Auditor:', D4: 'Jeffrey Bernal, Gulzar  Ahmed', G4: ' Contact No.:', H4: '055',
  B8: 'A', C8: 'MANAGEMENT', I8: 'Weight', J8: 'Complaince',
  B9: 'A1', C9: 'Is there a strategic plan?', I9: 4, J9: 'Partial',
  B10: 'A2', I10: 2, J10: 'NO',
  B11: 'A3', I11: 3, J11: 'full',
  B12: 'A4', I12: 4, J12: 'N/A',
  B13: 'B11', C13: 'Medical', I13: 0.85,
  B14: 'B1.1', C14: 'Medical (mislabelled sub-header)', I14: 0.5,
  B15: 'B11.2', I15: 2, J15: 'Partial',
  B16: 'C1.3', I16: 1, J16: 'Full',
  B17: 'C2.2', I17: 1, J17: 'No',
  B18: 'C9.9', I18: 1, J18: 'Full',
  B30: 'TOTAL FINAL SCORE', H30: 'str:0.71',
  B40: 'SR#', C40: 'Observation Notes', G40: 'Observation/Comment', H40: 'Evidence (Photo)',
  C41: 'Positive', G41: 'Good housekeeping', H41: 'err:#VALUE!',
  B42: 'A1', C42: 'Is there a strategic plan?', G42: 'No targets set.\r\nFirst line', H42: 'Picture',
  G43: 'continued on the next row',
  B44: 'A3', C44: 'Mandatory training?', H44: 'Addressed in B7.1',
  B45: 'A4', C45: 'Inspection schedules?', G45: 'NA- not applicable here',
  C46: 'Site / Other Findings', G46: 'Workers without first aid kits near the batching plant',
  C47: 'Positive Observations', G47: 'inline:Clean & tidy rest area',
  C48: 'Site / Other Findings', G48: 'Scaffold tag missing',
};

describe('xlsx reader', () => {
  it('decodes entities and OOXML escapes', () => {
    expect(decodeXml('a &amp; b &lt;c&gt; &#65;&#x42; _x000D_')).toBe('a & b <c> AB \r');
  });
  it('splits refs and converts Excel serial dates', () => {
    expect(splitRef('AA12')).toEqual({ col: 27, row: 12 });
    expect(excelSerialToIso(46222)).toBe('2026-07-19');
    expect(excelSerialToIso(45000.75)).toBe('2023-03-15');
  });
  it('reads sheets through the rels, shared / inline / formula strings and numbers, and never inflates media', () => {
    const wb = readWorkbook(buildXlsx(FIXTURE, { media: true }));
    expect(wb.sheetNames).toEqual(['Cover', 'Health & Safety']);
    expect(wb.sheet('Cover')!.cells.get('A1')).toBe('Cover');
    const s = wb.sheet('health & safety')!;
    expect(s.cells.get('H2')).toBe(46222);
    expect(s.cells.get('H30')).toBe('0.71');
    expect(s.cells.get('G47')).toBe('Clean & tidy rest area');
    expect(s.cells.get('H41')).toBe('#VALUE!');
    expect(s.maxRow).toBe(48);
  });
  it('rejects files that are not workbooks', () => {
    expect(() => readWorkbook(new Uint8Array([1, 2, 3]))).toThrow(/not an Excel workbook/);
  });
});

describe('cell helpers', () => {
  it('reads compliance in any case', () => {
    expect(['Full', 'partial', 'No', 'NO', 'N/A', ' n / a ', 'na', 'Yes', 3].map((v) => toCompliance(v as string))).toEqual(
      ['full', 'partial', 'no', 'no', 'na', 'na', 'na', null, null],
    );
  });
  it('derives subsections from codes, not the mislabelled sub-headers', () => {
    expect(subsectionOf('B11.2')).toBe('B11');
    expect(subsectionOf('C1.3')).toBe('C1');
    expect(subsectionOf('A4')).toBeNull();
  });
  it('classifies Part 3 labels and NA notes', () => {
    expect(labelKind('Positive')).toBe('positive');
    expect(labelKind(' Positive  Observations ')).toBe('positive');
    expect(labelKind('Site / Other Findings')).toBe('site');
    expect(labelKind('Is there a plan?')).toBeNull();
    expect(isNaNote('NA- none on site')).toBe(true);
    expect(isNaNote('• Not applicable')).toBe(true);
    expect(isNaNote('National plan missing')).toBe(false);
  });
  it('reads header dates', () => {
    expect(toIsoDate(46222)).toBe('2026-07-19');
    expect(toIsoDate('19/07/2026')).toBe('2026-07-19');
    expect(toIsoDate('2026-07-19T00:00:00')).toBe('2026-07-19');
    expect(toIsoDate('soon')).toBe('');
  });
});

describe('parseHsWorkbook', () => {
  const p = parseHsWorkbook(buildXlsx(FIXTURE, { media: true }), items);

  it('reads the header and maps the project to its contractor', () => {
    expect(p).toMatchObject({
      project: 'AL FAHD-4800001272', contractorId: '4800001272', date: '2026-07-19',
      location: 'Sub Region 2 - Coast Guard', inspectionNo: 'HSW-03', auditors: ['Jeffrey Bernal', 'Gulzar Ahmed'],
    });
  });
  it('reads Part 1 answers, skipping section / sub-header rows and unknown codes', () => {
    expect(p.answers).toEqual({ A1: 'partial', A2: 'no', A3: 'full', A4: 'na', 'B11.2': 'partial', 'C1.3': 'full', 'C2.2': 'no' });
    expect(p.warnings.some((w) => w.startsWith('C9.9'))).toBe(true);
  });
  it('flags workbook weights that differ from the checklist', () => {
    const wA2 = items.find((i) => i.code === 'A2')!.weight;
    const differs = wA2 !== 2;
    expect(p.warnings.some((w) => w.includes('A2 (2 in Excel'))).toBe(differs);
  });
  it('keeps the cached TOTAL FINAL SCORE only when numeric', () => {
    expect(p.reportedScore).toBeNull();
    const q = parseHsWorkbook(buildXlsx({ ...FIXTURE, H30: 0.712 }), items);
    expect(q.reportedScore).toBe(0.712);
  });
  it('reads Part 3: kinds, continuation rows, categories; drops empty and NA notes; never reads evidence', () => {
    expect(p.notes.map(({ code, kind, text, category }) => ({ code, kind, text, category }))).toEqual([
      { code: null, kind: 'positive', text: 'Good housekeeping', category: null },
      { code: 'A1', kind: 'finding', text: 'No targets set.\nFirst line\ncontinued on the next row', category: 'documents' },
      { code: null, kind: 'site', text: 'Workers without first aid kits near the batching plant', category: 'health' },
      { code: null, kind: 'positive', text: 'Clean & tidy rest area', category: null },
      { code: null, kind: 'site', text: 'Scaffold tag missing', category: 'site' },
    ]);
    expect(JSON.stringify(p)).not.toMatch(/Picture|#VALUE!|Addressed/);
  });
  it('lets the auditor pick the contractor for an unknown project', () => {
    const q = parseHsWorkbook(buildXlsx({ ...FIXTURE, D2: 'NEW JV-123' }), items);
    expect(q.contractorId).toBeNull();
    expect(q.warnings[0]).toMatch(/NEW JV-123/);
  });
  it('fails clearly without the H&S sheet', () => {
    expect(() => parseHsWorkbook(buildXlsx(FIXTURE, { sheetName: 'Security' }), items)).toThrow(/Health & Safety/);
  });
  it('becomes an Excel-sourced H&S draft', () => {
    const d = draftFromParsed(p, 'x.xlsx', emptyDraft('security'));
    expect(d).toMatchObject({ type: 'hs', source: 'excel', fileName: 'x.xlsx', details: { contractorId: '4800001272' } });
    expect(d.notes).toHaveLength(5);
  });
});
