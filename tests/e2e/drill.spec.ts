import { test, expect, type Page } from '@playwright/test';
import { getRepo } from '../../lib/data/repo';

const active = (page: Page) => page.locator('[data-testid="slide"][data-active]');
const ready = (page: Page) => expect(page.getByTestId('carousel')).toHaveAttribute('data-ready', '');
const escReady = (page: Page) => expect(page.locator('body')).toHaveAttribute('data-esc-ready', '');

test('four-level drill from the main problem to an observation, Esc back to the item', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('main-problem').getByRole('link').click();
  await expect(page).toHaveURL(/\/category\/subcontractor\?q=all&r=SR1%2CSR2$/);
  await ready(page);

  await active(page).getByTestId('contractor-row').first().click();
  await expect(page).toHaveURL(/\/category\/subcontractor\/\d{10}\?q=all&r=SR1%2CSR2/);
  await ready(page);

  await active(page).getByTestId('item-row').first().click();
  await expect(page).toHaveURL(/\/category\/subcontractor\/\d{10}\/B6\.1\?q=all/);
  const itemUrl = page.url();

  await page.getByTestId('observation-link').first().click();
  await expect(page.getByTestId('observation-text')).toBeVisible();
  await expect(page.getByTestId('observation-text')).not.toBeEmpty();
  const crumbs = page.getByTestId('breadcrumb');
  await expect(crumbs.getByRole('link')).toHaveCount(4);
  await expect(crumbs.getByRole('link').first()).toHaveText('Overview');

  await escReady(page);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(itemUrl);
  await expect(page.getByTestId('item-timeline')).toBeVisible();
});

test('ArrowRight moves to the earlier audit and writes s=1', async ({ page }) => {
  await page.goto('/contractor/4800001131?q=all&r=SR1%2CSR2');
  await ready(page);
  await expect(active(page).getByTestId('slide-score')).toHaveText('85%');
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/[?&]s=1(&|$)/);
  await expect(page).toHaveURL(/q=all/);
  await expect(active(page).getByTestId('slide-score')).toHaveText('74%');
  await page.keyboard.press('ArrowLeft');
  await expect(page).not.toHaveURL(/s=1/);
  await expect(active(page).getByTestId('slide-score')).toHaveText('85%');
});

test('dragging left swipes to the earlier audit', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/contractor/4800001131');
  await ready(page);
  const box = (await active(page).getByTestId('category-gaps').boundingBox())!;
  const y = box.y + 20;
  await page.mouse.move(box.x + box.width - 40, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + box.width - 40 - i * 60, y);
  await page.mouse.up();
  await expect(page).toHaveURL(/[?&]s=1(&|$)/);
  await expect(active(page).getByTestId('slide-score')).toHaveText('74%');
});

test('deep link ?s=1 opens the earlier (Q4) audit in view', async ({ page }) => {
  await page.goto('/contractor/4800001131?s=1');
  const slide = active(page);
  await expect(slide.getByTestId('slide-header')).toContainText('Q4 2025');
  await expect(slide.getByTestId('slide-score')).toHaveText('74%');
  await ready(page);
  await expect(slide.getByTestId('slide-header')).toBeInViewport();
  const box = (await slide.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x).toBeLessThan(80);
});

test('a contractor audited once has no audit arrows', async ({ page }) => {
  await page.goto('/contractor/4200000026');
  await expect(page.getByTestId('slide')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Previous audit' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Next audit' })).toHaveCount(0);
});

test('category carousel is by quarter, latest first, with quarter arrows', async ({ page }) => {
  await page.goto('/category/subcontractor');
  await expect(page.getByTestId('slide')).toHaveCount(2);
  await expect(active(page).getByTestId('slide-header')).toContainText('Q1 2026');
  await ready(page);
  await page.getByRole('button', { name: 'Previous quarter' }).click();
  await expect(page).toHaveURL(/s=1/);
  await expect(active(page).getByTestId('slide-header')).toContainText('Q4 2025');
  const href = await active(page).getByTestId('contractor-row').first().getAttribute('href');
  expect(href).toMatch(/q=all&r=SR1%2CSR2/);
});

test('unknown ids and mismatched paths are 404', async ({ page }) => {
  for (const url of [
    '/contractor/nope',
    '/category/nope',
    '/category/documents/nope',
    '/category/documents/4800001131/B6.1',
    '/category/subcontractor/4800001131/ZZ9',
    '/category/subcontractor/4800001131/B6.1/nope',
    '/category/monitoring/4800001131/A4/4800000876-Q1-2026-20260215-9',
  ]) {
    const res = await page.goto(url);
    expect(res?.status(), url).toBe(404);
  }
  // A malformed escape is refused by the server, never a crash.
  const bad = await page.goto('/category/documents/4800001131/%E0%A4%A');
  expect([400, 404]).toContain(bad?.status());
});

test('the longest observation stays inside its card at 1366', async ({ page }) => {
  const repo = getRepo();
  const items = new Map(repo.checklist().map((i) => [i.code, i]));
  const longest = repo.observations().filter((o) => o.itemCode).reduce((m, o) => (o.text.length > m.text.length ? o : m));
  const audit = repo.audits().find((a) => a.id === longest.auditId)!;
  const item = items.get(longest.itemCode!)!;
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`/category/${item.category}/${audit.contractorId}/${item.code}/${longest.id}`);
  const text = page.getByTestId('observation-text');
  await expect(text).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const t = (await text.boundingBox())!;
  const card = (await page.getByTestId('observation').boundingBox())!;
  expect(t.x + t.width).toBeLessThanOrEqual(card.x + card.width + 0.5);
  expect(await text.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe('pre-line');
});

for (const vp of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
  test(`details pages have no horizontal scroll at ${vp.width}`, async ({ page }) => {
    await page.setViewportSize(vp);
    for (const url of ['/contractor/4800000838', '/category/subcontractor', '/category/documents/4800001134', '/category/subcontractor/4800001131/B6.1']) {
      await page.goto(url);
      await expect(page.getByTestId('breadcrumb')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), url).toBe(true);
    }
  });
}

test('reduced motion still navigates between audits', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/contractor/4800000838');
  await ready(page);
  await expect(page.getByTestId('slide')).toHaveCount(3);
  await page.getByRole('button', { name: 'Previous audit' }).click();
  await expect(page).toHaveURL(/s=1/);
  await expect(active(page).getByTestId('slide-header')).toContainText('19 Nov 2025');
  await expect(active(page).getByTestId('slide-header')).toBeInViewport();
  await page.getByRole('button', { name: 'Next audit' }).click();
  await expect(active(page).getByTestId('slide-header')).toContainText('1 Feb 2026');
  await ctx.close();
});

test('findings show three per category, then all', async ({ page }) => {
  await page.goto('/contractor/4800001131');
  await ready(page);
  const group = active(page).getByTestId('finding-group').first();
  await expect(group.getByTestId('finding')).toHaveCount(3);
  await group.getByRole('button', { name: /Show all \d+/ }).click();
  expect(await group.getByTestId('finding').count()).toBeGreaterThan(3);
});

test('category rows on a contractor slide open that audit in the category', async ({ page }) => {
  await page.goto('/contractor/4800001131?s=1');
  const href = await active(page).getByTestId('category-gap-row').first().getAttribute('href');
  expect(href).toMatch(/^\/category\/[a-z]+\/4800001131\?q=all&r=SR1%2CSR2&s=1$/);
});

test('item states are neutral notes with a score-based section gap, never pass/fail', async ({ page }) => {
  await page.goto('/category/subcontractor/4800001131');
  await ready(page);
  const rows = active(page).getByTestId('item-row');
  expect(await rows.count()).toBeGreaterThan(0);
  for (const s of await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-state')))) expect(['noted', 'none', 'na']).toContain(s);
  await expect(rows.first().getByTestId('section-gap')).toBeVisible();
  await expect(page.getByTestId('details')).not.toContainText(/fail|Finding/i);
  await page.goto('/category/subcontractor/4800001131/B6.1');
  await expect(page.getByTestId('item-summary')).toContainText('Noted in');
  await expect(page.getByTestId('details')).not.toContainText(/failed/i);
});

test('reduced motion zeroes CSS transitions and press transforms', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/contractor/4800001131');
  await ready(page);
  const dot = page.getByRole('button', { name: /Mar 2026/ }).locator('span');
  expect(await dot.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
  const btn = page.getByRole('button', { name: 'Previous audit' });
  await btn.hover();
  await page.mouse.down();
  expect(await btn.evaluate((el) => getComputedStyle(el).scale)).toBe('none');
  await page.mouse.up();
  await ctx.close();
});

test('a Q4 contractor row opens the contractor on that Q4 audit (same score)', async ({ page }) => {
  await page.goto('/?q=Q4-2025&r=SR1%2CSR2');
  await expect(page.getByTestId('contractors')).toHaveAttribute('data-hydrated', '');
  const link = page.locator('[data-testid="contractor-row"] a[href^="/contractor/4800001131"]');
  await expect(link).toHaveAttribute('aria-label', /, 74%, /);
  await link.click();
  await expect(page).toHaveURL(/\/contractor\/4800001131\?q=Q4-2025/);
  await ready(page);
  await expect(active(page).getByTestId('slide-score')).toHaveText('74%');
  // going to the latest audit writes s=0, so a reload stays there instead of jumping back to Q4
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(/[?&]s=0(&|$)/);
  await page.reload();
  await ready(page);
  await expect(active(page).getByTestId('slide-score')).toHaveText('85%');
});

test('the Q4 main-problem tile opens its category on Q4 with the same gap and item anchors', async ({ page }) => {
  await page.goto('/?q=Q4-2025&r=SR1%2CSR2');
  const link = page.getByTestId('main-problem').getByRole('link');
  const gap = /gap (\d+)%/.exec((await link.getAttribute('aria-label'))!)![1];
  await link.click();
  await expect(page).toHaveURL(/\/category\/[a-z]+\?q=Q4-2025/);
  await ready(page);
  await expect(active(page).getByTestId('slide-score')).toHaveText(`${gap}%`);
  await expect(active(page).locator('[id^="item-"]').first()).toBeAttached();
});
