import { test, expect } from '@playwright/test';
import { getRepo } from '../../lib/data/repo';
import { filterAudits, mainProblem } from '../../lib/analytics';
import { itemLabel } from '../../lib/itemLabels';

const ALL = { quarter: 'all' as const, regions: ['SR1', 'SR2'] as ('SR1' | 'SR2')[] };
/** The gap figure before this change: clamp(52px, 9svh, 104px). */
const OLD_FIGURE = (h: number) => Math.min(104, Math.max(52, 0.09 * h));

test('main problem drivers are plain labels with "N of M audits", no item codes', async ({ page }) => {
  const repo = getRepo();
  const problem = mainProblem(repo, ALL)!;
  const audits = filterAudits(repo, { ...ALL, quarter: problem.quarter }).length;
  await page.goto('/');
  const mp = page.getByTestId('main-problem');
  const rows = mp.getByTestId('main-problem-driver');
  await expect(rows).toHaveCount(3);
  expect(problem.items).toHaveLength(3);
  for (const [i, it] of problem.items.entries()) {
    const label = itemLabel(it.itemCode, it.question);
    expect(label.length).toBeLessThanOrEqual(40);
    await expect(rows.nth(i)).toContainText(label);
    await expect(rows.nth(i)).toContainText(`${it.hits} of ${audits} audits`);
  }
  expect(await mp.innerText()).not.toMatch(/\bB\d+\.\d+\b/);
  expect(await mp.innerText()).not.toMatch(/\b[ABC]\d+(\.\d+)?\b/);
  // label left, count right-aligned at the row's end
  const row = (await rows.first().boundingBox())!;
  const count = (await rows.first().locator(':scope > span').last().boundingBox())!;
  expect(Math.abs(count.x + count.width - (row.x + row.width))).toBeLessThan(2);
});

for (const vp of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) test(`main problem gap figure is larger than before and not clipped at ${vp.width}`, async ({ page }) => {
  await page.setViewportSize(vp);
  await page.goto('/');
  const mp = page.getByTestId('main-problem');
  const fig = mp.getByTestId('main-problem-gap');
  const size = await fig.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  expect(size).toBeGreaterThan(OLD_FIGURE(vp.height) * 1.15);
  await page.waitForTimeout(1600); // count-up and entrance done
  const card = (await mp.boundingBox())!;
  const f = (await fig.boundingBox())!;
  expect(f.y).toBeGreaterThanOrEqual(card.y);
  expect(f.y + f.height).toBeLessThanOrEqual(card.y + card.height);
  // the figure and the gap / Δ labels stay side by side inside the left column
  const label = (await mp.getByText('gap', { exact: true }).boundingBox())!;
  expect(label.x).toBeGreaterThanOrEqual(f.x + f.width - 1);
  expect(await mp.locator('div.grid').evaluate((e) => e.scrollHeight <= e.clientHeight + 1)).toBe(true);
  expect(await fig.evaluate((e) => e.scrollWidth <= (e.parentElement as HTMLElement).clientWidth + 1)).toBe(true);
  await expect(mp).toContainText(/vs Q4/);
  await expect(mp).toBeInViewport({ ratio: 1 });
});
