import { test, expect } from '@playwright/test';

const REPORT = '/audit/4800001272-Q4-2025-20251029';

test('report shows the official score and band', async ({ page }) => {
  await page.goto(REPORT);
  await expect(page.getByTestId('report-total')).toHaveText('71%');
  await expect(page.getByTestId('report-band')).toHaveText('Partially Compliant');
  await expect(page.getByTestId('section-row')).toHaveCount(15);
  const crumbs = page.getByTestId('breadcrumb');
  await expect(crumbs.getByRole('link')).toHaveCount(2);
  await expect(crumbs).toContainText('Audit 29 Oct 2025');
  await expect(page.getByTestId('report-contractor')).toHaveAttribute('href', /^\/contractor\/4800001272\?/);
});

test('negative observations are the default tab and include site findings', async ({ page }) => {
  await page.goto(REPORT);
  const panel = page.getByTestId('panel-negative');
  await expect(page.getByTestId('tab-negative')).toHaveAttribute('aria-selected', 'true');
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId('site-tag').first()).toBeVisible();
  await expect(page.getByTestId('panel-positive')).toBeHidden();
  await expect(page.getByText(/failed/i)).toHaveCount(0);
});

test('the Positive observations tab lists 14', async ({ page }) => {
  await page.goto(REPORT);
  await page.getByTestId('tab-positive').click();
  await expect(page).toHaveURL(/[?&]tab=positive(&|$)/);
  const panel = page.getByTestId('panel-positive');
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId('report-entry')).toHaveCount(14);
  await expect(page.getByTestId('panel-negative')).toBeHidden();
});

test('the Site chip filters the list to site findings only and sets cat=site', async ({ page }) => {
  await page.goto(REPORT);
  const panel = page.getByTestId('panel-negative');
  await expect(panel.getByTestId('report-group').filter({ visible: true })).not.toHaveCount(1);
  await page.locator('[data-testid="cat-chip"][data-cat="site"]').click();
  await expect(page).toHaveURL(/[?&]cat=site(&|$)/);
  const groups = panel.getByTestId('report-group').filter({ visible: true });
  await expect(groups).toHaveCount(1);
  await expect(groups).toHaveAttribute('data-category', 'site');
  const entries = panel.getByTestId('report-entry').filter({ visible: true });
  await expect(entries).toHaveCount(6);
  for (const cat of await entries.evaluateAll((els) => els.map((e) => e.getAttribute('data-category')))) expect(cat).toBe('site');
  await expect(page.locator('[data-testid="cat-chip"][data-cat="site"]')).toHaveAttribute('aria-current', 'true');
});

test('an unknown audit id returns 404', async ({ page }) => {
  const res = await page.goto('/audit/0000000000-Q4-2025-20250101');
  expect(res?.status()).toBe(404);
  await expect(page.getByTestId('not-found')).toBeVisible();
});

test('a past-audits dot on the portfolio view opens a report that renders', async ({ page }) => {
  await page.goto('/audits?q=all&r=SR1%2CSR2');
  const dot = page.getByTestId('audit-dot').first();
  const link = (await dot.getAttribute('href'))!;
  expect(link).toMatch(/\?q=all&r=SR1%2CSR2$/);
  const id = link.replace(/^\/audit\//, '').split('?')[0];
  await dot.click();
  await expect(page).toHaveURL(new RegExp(`/audit/${id}`));
  await expect(page.getByTestId('report-total')).toHaveText(/^\d+%$/);
  await expect(page.getByTestId('report-observations')).toBeVisible();
});

test('"Full report" on a contractor page opens its report; Esc goes back to the contractor', async ({ page }) => {
  await page.goto('/contractor/4800001131');
  await expect(page.getByTestId('carousel')).toHaveAttribute('data-ready', '');
  await page.locator('[data-testid="slide"][data-active]').getByRole('link', { name: 'Full report' }).click();
  await expect(page).toHaveURL(/\/audit\/4800001131-Q1-2026-20260301\?/);
  await expect(page.getByTestId('report-total')).toHaveText('85%');
  await expect(page.locator('body')).toHaveAttribute('data-esc-ready', '');
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/contractor\/4800001131\?/);
});

test('no horizontal scroll at 1366', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(REPORT);
  await expect(page.getByTestId('report-total')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('print media hides the top bar and chrome and shows both tabs', async ({ page }) => {
  await page.goto(REPORT);
  await expect(page.getByTestId('topbar')).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByTestId('topbar')).toBeHidden();
  await expect(page.getByRole('tablist')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Print' })).toBeHidden();
  await expect(page.getByTestId('panel-negative')).toBeVisible();
  await expect(page.getByTestId('panel-positive')).toBeVisible();
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(255, 255, 255)');
});

test('the report total carries the official-total note', async ({ page }) => {
  await page.goto(REPORT);
  await expect(page.getByTestId('report-total-note')).toHaveText('Official total from the audit workbook');
  await expect(page.getByRole('tab', { name: /^Observations/ })).toBeVisible();
  await expect(page.getByText(/Negative observations/)).toHaveCount(0);
});

test('past-audits dot links keep the quarter and region filter', async ({ page }) => {
  await page.goto('/audits?q=Q4-2025&r=SR2');
  const hrefs = await page.getByTestId('audit-dot').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const h of hrefs) expect(h).toMatch(/^\/audit\/[\w-]+\?q=Q4-2025&r=SR2$/);
});
