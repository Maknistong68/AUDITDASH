import { test, expect, type Page } from '@playwright/test';
import { getRepo } from '../../lib/data/repo';

const TABS = ['H&S', 'Security', 'Environmental', 'Welfare', 'CRC'];
const auditId = getRepo().audits()[0].id;
const tabs = (page: Page) => page.getByTestId('type-tabs');
const hydrated = (page: Page) => expect(page.getByTestId('contractors')).toHaveAttribute('data-hydrated', '');

test('type tabs: five tabs, H&S active by default', async ({ page }) => {
  await page.goto('/');
  await expect(tabs(page).getByRole('button')).toHaveText(TABS);
  await expect(tabs(page).getByRole('button', { name: 'H&S' })).toHaveAttribute('aria-pressed', 'true');
  for (const t of TABS.slice(1)) await expect(tabs(page).getByRole('button', { name: t })).toHaveAttribute('aria-pressed', 'false');
});

test('switching type writes t and highlights the active tab', async ({ page }) => {
  await page.goto('/');
  await hydrated(page);
  await tabs(page).getByRole('button', { name: 'Security' }).click();
  await expect(page).toHaveURL(/[?&]t=security(&|$)/);
  await expect(tabs(page).getByRole('button', { name: 'Security' })).toHaveAttribute('aria-pressed', 'true');
  await expect(tabs(page).getByRole('button', { name: 'H&S' })).toHaveAttribute('aria-pressed', 'false');
  await tabs(page).getByRole('button', { name: 'CRC' }).click();
  await expect(page).toHaveURL(/[?&]t=crc(&|$)/);
  await expect(tabs(page).getByRole('button', { name: 'CRC' })).toHaveAttribute('aria-pressed', 'true');
  await tabs(page).getByRole('button', { name: 'H&S' }).click(); // H&S is the default: no t
  await expect(page).not.toHaveURL(/[?&]t=/);
  await expect(page.getByTestId('contractor-row')).toHaveCount(12);
});

test('switching type keeps q and r', async ({ page }) => {
  await page.goto('/?q=Q1-2026&r=SR1');
  await hydrated(page);
  await tabs(page).getByRole('button', { name: 'Welfare' }).click();
  await expect(page).toHaveURL(/\/\?q=Q1-2026&r=SR1&t=welfare$/);
  await expect(page.getByRole('button', { name: 'Q1 2026' })).toHaveAttribute('aria-pressed', 'true');
  // and the quarter tabs keep t
  await page.getByRole('button', { name: 'Q4 2025' }).click();
  await expect(page).toHaveURL(/\/\?q=Q4-2025&r=SR1&t=welfare$/);
});

test('switching type on a details page goes to that type\'s overview', async ({ page }) => {
  await page.goto('/contractor/4800001131?q=Q1-2026&r=SR1%2CSR2');
  await expect(page.getByTestId('details')).toBeVisible();
  await tabs(page).getByRole('button', { name: 'Environmental' }).click();
  await expect(page).toHaveURL(/\/\?q=Q1-2026&r=SR1%2CSR2&t=environmental$/);
  await expect(page.getByTestId('type-empty')).toBeVisible();
});

for (const path of ['/', '/contractor/4800001131', `/audit/${auditId}`]) {
  test(`+ New Audit is visible on ${path.split('/')[1] || 'overview'} with the type's href`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByTestId('new-audit')).toBeVisible();
    await expect(page.getByTestId('new-audit')).toHaveAttribute('href', '/audits/new?type=hs');
    await expect(page.getByTestId('new-audit')).toHaveAccessibleName('New audit');
    await page.goto(`${path}?q=all&r=SR1%2CSR2&t=security`);
    await expect(page.getByTestId('new-audit')).toHaveAttribute('href', '/audits/new?type=security');
  });
}

test('+ New Audit href follows every tab', async ({ page }) => {
  for (const t of ['hs', 'security', 'environmental', 'welfare', 'crc']) {
    await page.goto(t === 'hs' ? '/' : `/?t=${t}`);
    await expect(page.getByTestId('new-audit')).toHaveAttribute('href', `/audits/new?type=${t}`);
  }
});

test('the new-audit page answers 200', async ({ page }) => {
  const res = await page.goto('/audits/new?type=crc');
  expect(res!.status()).toBe(200);
  await expect(page.getByTestId('new-audit-page')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('New audit');
  await expect(tabs(page).getByRole('button', { name: 'CRC' })).toHaveAttribute('aria-pressed', 'true');
});

test('a type with no audits shows its empty state, no H&S data', async ({ page }) => {
  await page.goto('/?t=security');
  const empty = page.getByTestId('type-empty');
  await expect(empty).toBeVisible();
  await expect(empty).toContainText('Security');
  await expect(empty.getByRole('heading')).toHaveText('No audits yet');
  await expect(empty.getByRole('link', { name: 'New Audit' })).toHaveAttribute('href', '/audits/new?type=security');
  await expect(page.locator('text=NaN')).toHaveCount(0);
  for (const id of ['contractor-row', 'main-problem', 'audit-overview', 'main-issues', 'reel', 'empty-state']) await expect(page.getByTestId(id)).toHaveCount(0);
  await page.goto('/?t=environmental');
  await expect(page.getByTestId('type-empty')).toContainText('Environmental');
});

test('the name is Audits, with no logo mark', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Audits');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Audits');
  await expect(page.getByRole('heading', { level: 1 }).locator('xpath=..').locator('svg')).toHaveCount(0);
  await page.goto('/contractor/4800001131');
  await expect(page).toHaveTitle('JV-ECH (Port T1) · Audits');
});

test('dark is the one theme: no switch, a stored light choice is ignored', async ({ browser }) => {
  const light = await browser.newContext({ colorScheme: 'light' });
  await light.addInitScript(() => { try { localStorage.setItem('theme', 'light'); } catch { /* private mode */ } });
  const q = await light.newPage();
  await q.goto('/');
  await expect(q.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(q.getByRole('button', { name: /theme/i })).toHaveCount(0);
  await light.close();
});

for (const vp of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
  test(`header sits on one row at ${vp.width}`, async ({ page }) => {
    await page.setViewportSize(vp);
    for (const path of ['/', '/contractor/4800001131']) {
      await page.goto(path);
      const bar = (await page.getByTestId('topbar').boundingBox())!;
      expect(bar.height).toBeLessThanOrEqual(57);
      const ys = await page.getByTestId('topbar').evaluate((el) =>
        ['type-tabs', 'new-audit'].map((id) => el.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect())
          .concat([...el.querySelectorAll('[role="group"], button[aria-label*="theme"]')].map((e) => e.getBoundingClientRect()))
          .map((r) => Math.round(r.top + r.height / 2)));
      expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(1);
      // tabs left of centre, + New Audit right
      const t = (await tabs(page).boundingBox())!;
      const n = (await page.getByTestId('new-audit').boundingBox())!;
      expect(t.x + t.width).toBeLessThan(vp.width / 2);
      expect(n.x).toBeGreaterThan(vp.width / 2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}

test('type tabs fit a phone without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const t = (await tabs(page).boundingBox())!;
  expect(t.x + t.width).toBeLessThanOrEqual(390);
});
