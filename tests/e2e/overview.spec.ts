import { expect, test } from '@playwright/test';

/** Owner direction 2026-10-30: split the biggest card, a line chart, hover reveals, one place per thing. */

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

test('the line chart has one point per month with audits; hover shows that month\'s audits', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const chart = page.getByTestId('score-line');
  // Oct, Nov, Dec 2025; Jan, Feb, Mar, Jul 2026
  await expect(chart.getByTestId('score-line-point')).toHaveCount(7);
  expect(await chart.getByTestId('score-line-point').evaluateAll((els) => els.map((e) => e.getAttribute('data-value')))).toEqual(
    ['66', '69', '65', '69', '60', '58', '60'],
  );
  const box = (await chart.boundingBox())!;
  await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2);
  const tip = page.getByTestId('score-line-tip');
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('Jul 2026');
  await expect(tip).toContainText('1 audit');
  await expect(tip).toContainText('Al Fahd (Coast Guard)');
});

test('headline figures use the honest score computed from the Excel points', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('kpi-score')).toContainText('63');
  await expect(page.getByTestId('kpi-score')).toContainText('21 audits');
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

test('navigation: Overview and Log; the old portfolio page redirects to the Log', async ({ page }) => {
  await page.goto('/?q=Q1-2026&r=SR1%2CSR2');
  const nav = page.getByTestId('main-nav');
  await expect(nav.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
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
  await expect(page.getByTestId('score-line-point')).toHaveCount(7);
  const o = await page.getByTestId('contractors').evaluate((e) => getComputedStyle(e).opacity);
  expect(Number(o)).toBe(1);
  await ctx.close();
});
