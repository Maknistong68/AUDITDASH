import { expect, test } from '@playwright/test';

/** Owner direction 2026-10-30: split the biggest card, score by quarter, hover reveals, three small bottom cards. */

test('the left half is split: contractors ranked on top, score over time below', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const top = (await page.getByTestId('contractors').boundingBox())!;
  const bottom = (await page.getByTestId('score-trend').boundingBox())!;
  expect(Math.abs(top.x - bottom.x)).toBeLessThan(2);
  expect(Math.abs(top.width - bottom.width)).toBeLessThan(2);
  expect(bottom.y).toBeGreaterThan(top.y + top.height);
  await expect(page.getByTestId('contractor-row')).toHaveCount(12);
});

test('score by quarter: one line per contractor, the portfolio in bold; hover names a line', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const chart = page.getByTestId('quarter-lines');
  await expect(chart.getByTestId('quarter-line')).toHaveCount(12);
  await expect(chart).toContainText('Q4 2025');
  await expect(chart).toContainText('Q1 2026');
  await expect(chart).not.toContainText('Q3');
  await expect(chart.getByTestId('quarter-portfolio')).toContainText('67%');
  await expect(chart.getByTestId('quarter-portfolio')).toContainText('61%');
  await expect(page.getByTestId('quarter-moves')).toHaveText('2 up4 down');
});

test('headline figures use the honest score computed from the Excel points', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('kpi-score')).toContainText('64');
  await expect(page.getByTestId('kpi-score')).toContainText('20 audits');
  await expect(page.getByTestId('audits-count')).toHaveText('20');
  await expect(page.getByTestId('audits-by-quarter')).toContainText('9 Q4 2025');
  await expect(page.getByTestId('audits-by-quarter')).toContainText('11 Q1 2026');
  await expect(page.getByTestId('region-col')).toHaveCount(2);
  await expect(page.getByTestId('contractor-row').first()).toContainText('JV-ECH');
  await expect(page.getByTestId('contractor-row').first()).toContainText('74');
  await expect(page.getByTestId('main-problem')).toContainText('Subcontractor Control');
  await expect(page.getByTestId('main-problem')).toContainText('All audits');
});

test('hovering a card reveals its second layer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const opacity = (id: string) => page.getByTestId(id).evaluate((e) => Number(getComputedStyle(e).opacity));

  expect(await opacity('main-problem-ranking')).toBeLessThan(0.1);
  await page.getByTestId('main-problem').hover();
  await expect.poll(() => opacity('main-problem-ranking')).toBeGreaterThan(0.9);
  await expect(page.getByTestId('main-problem-ranking').locator('li')).toHaveCount(8);

  await page.getByTestId('kpi-score').hover();
  await expect.poll(() => opacity('kpi-score-insight')).toBeGreaterThan(0.9);
  await expect(page.getByTestId('kpi-score-insight')).toContainText('Excel totals differ');

  await page.getByTestId('kpi-repeats').hover();
  await expect.poll(() => opacity('repeats-by-contractor')).toBeGreaterThan(0.9);

  await page.getByTestId('contractor-row').nth(2).hover();
  await expect(page.getByTestId('contractor-peek')).toBeVisible();
  await expect(page.getByTestId('contractor-peek')).toContainText('Management');
});

test('navigation: no Overview button, a Log link; the old portfolio page redirects to the Log', async ({ page }) => {
  await page.goto('/?q=Q1-2026&r=SR1%2CSR2');
  const nav = page.getByTestId('main-nav');
  await expect(nav.getByRole('link', { name: 'Overview' })).toHaveCount(0);
  await nav.getByRole('link', { name: 'Log' }).click();
  await expect(page).toHaveURL(/\/log\?.*q=Q1-2026/);
  await page.goto('/audits?q=all&r=SR1%2CSR2');
  await expect(page).toHaveURL(/\/log\?.*view=audits/);
});

test('the Portfolio card opens the audits log', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Portfolio score/ }).click();
  await expect(page).toHaveURL(/\/log\?.*view=audits/);
});

test('reduced motion: everything is in place at once', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.getByTestId('quarter-line')).toHaveCount(12);
  const o = await page.getByTestId('contractors').evaluate((e) => getComputedStyle(e).opacity);
  expect(Number(o)).toBe(1);
  await ctx.close();
});
