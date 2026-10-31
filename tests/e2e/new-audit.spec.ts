import { strToU8, zipSync } from 'fflate';
import { expect, test } from '@playwright/test';

/** A tiny synthetic H&S checklist workbook (never the real, confidential one). */
function workbook(): Buffer {
  const shared = [' Project:', 'AL FAHD-4800001272', ' Date:', ' Auditor:', 'Test Auditor', 'A1', 'Full', 'A2', 'No', 'SR#', 'Positive', 'Tidy site', 'No targets set', 'Site / Other Findings', 'No drinking water at gate', 'TOTAL FINAL SCORE'];
  const s = (v: string) => shared.indexOf(v);
  const rows = [
    `<row r="2"><c r="B2" t="s"><v>${s(' Project:')}</v></c><c r="D2" t="s"><v>${s('AL FAHD-4800001272')}</v></c><c r="G2" t="s"><v>${s(' Date:')}</v></c><c r="H2"><v>46222</v></c></row>`,
    `<row r="4"><c r="B4" t="s"><v>${s(' Auditor:')}</v></c><c r="D4" t="s"><v>${s('Test Auditor')}</v></c></row>`,
    `<row r="9"><c r="B9" t="s"><v>${s('A1')}</v></c><c r="I9"><v>4</v></c><c r="J9" t="s"><v>${s('Full')}</v></c></row>`,
    `<row r="10"><c r="B10" t="s"><v>${s('A2')}</v></c><c r="I10"><v>2</v></c><c r="J10" t="s"><v>${s('No')}</v></c></row>`,
    `<row r="20"><c r="B20" t="s"><v>${s('TOTAL FINAL SCORE')}</v></c><c r="H20"><v>0.9</v></c></row>`,
    `<row r="30"><c r="B30" t="s"><v>${s('SR#')}</v></c></row>`,
    `<row r="31"><c r="C31" t="s"><v>${s('Positive')}</v></c><c r="G31" t="s"><v>${s('Tidy site')}</v></c></row>`,
    `<row r="32"><c r="B32" t="s"><v>${s('A2')}</v></c><c r="G32" t="s"><v>${s('No targets set')}</v></c></row>`,
    `<row r="33"><c r="C33" t="s"><v>${s('Site / Other Findings')}</v></c><c r="G33" t="s"><v>${s('No drinking water at gate')}</v></c></row>`,
  ].join('');
  return Buffer.from(zipSync({
    'xl/workbook.xml': strToU8('<workbook xmlns:r="r"><sheets><sheet name="Health &amp; Safety" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': strToU8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'),
    'xl/sharedStrings.xml': strToU8(`<sst>${shared.map((t) => `<si><t xml:space="preserve">${t}</t></si>`).join('')}</sst>`),
    'xl/worksheets/sheet1.xml': strToU8(`<worksheet><sheetData>${rows}</sheetData></worksheet>`),
  }));
}

test('upload a checklist workbook and walk the four steps', async ({ page }) => {
  await page.goto('/audits/new?type=hs');
  await page.getByTestId('xlsx-input').setInputFiles({ name: 'synthetic.xlsx', mimeType: 'application/octet-stream', buffer: workbook() });
  await expect(page.getByTestId('import-summary')).toContainText('2/81');
  await expect(page.getByTestId('contractor-select')).toHaveValue('4800001272');
  await expect(page.getByTestId('date-input')).toHaveValue('2026-07-19');
  await page.getByTestId('wizard-next').click();
  await expect(page.getByTestId('question')).toHaveCount(81);
  await page.locator('[data-filter=findings]').click();
  await expect(page.getByTestId('question')).toHaveCount(1);
  await page.getByTestId('wizard-next').click();
  await expect(page.getByTestId('note-card')).toHaveCount(3);
  await expect(page.locator('[data-kind=site] [data-testid=category-select]')).toHaveValue('health');
  await expect(page.getByTestId('excel-vs-honest')).toContainText('Excel says 90%');
  await page.getByTestId('save-draft').click();
  await page.goto('/audits/new?type=hs');
  await expect(page.getByTestId('saved-item')).toHaveCount(1);
});

test('a question note keeps every character as typed (leading, double and trailing spaces, new lines): dictation on phones repeats words when the field is rewritten', async ({ page }) => {
  await page.goto('/audits/new?type=hs');
  await page.getByTestId('manual-card').getByText('Start', { exact: true }).click();
  await page.getByTestId('wizard-next').click();
  await expect(page.getByTestId('question')).toHaveCount(81);
  const first = page.getByTestId('question').first();
  await first.getByTestId('add-note').click();
  const note = first.getByTestId('question-note');
  await expect(note).toBeFocused();
  const handle = await note.elementHandle();
  await page.keyboard.type(' two  words ');
  await expect(note).toHaveValue(' two  words ');
  await page.keyboard.press('Enter');
  await page.keyboard.type('next line ');
  await expect(note).toHaveValue(' two  words \nnext line ');
  expect(await handle!.evaluate((el) => el.isConnected)).toBe(true);  // the same field all along: never remounted
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Backspace');
  await expect(note).toHaveValue('');
  await page.keyboard.type('again');
  await expect(note).toHaveValue('again');
  await page.getByTestId('wizard-next').click();
  await expect(page.getByTestId('note-card')).toHaveCount(1);
  await expect(page.getByTestId('note-card').locator('textarea')).toHaveValue('again');
});
