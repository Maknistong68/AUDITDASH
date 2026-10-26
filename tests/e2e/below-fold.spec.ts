import { test, expect } from '@playwright/test';
import { getRepo } from '../../lib/data/repo';
import { topIssues } from '../../lib/analytics';

const ALL = { quarter: 'all' as const, regions: ['SR1', 'SR2'] as ('SR1' | 'SR2')[] };

test('reel lists every filtered audit, newest first', async ({ page }) => {
  await page.goto('/');
  const cards = page.getByTestId('reel-card');
  await expect(cards).toHaveCount(20);
  const dates = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-date') ?? ''));
  expect(dates).toEqual([...dates].sort().reverse());
  await expect(cards.first()).toContainText(/\d{1,2} [A-Z][a-z]{2} \d{4}/);
  await page.goto('/?q=Q1-2026&r=SR1');
  await expect(cards).toHaveCount(8);
});

test('clicking the first reel card opens its audit', async ({ page }) => {
  await page.goto('/');
  const first = page.getByTestId('reel-card').first();
  await expect(first).toHaveAttribute('href', /^\/audit\/[\w-]+$/);
  await first.click();
  await expect(page).toHaveURL(/\/audit\/[\w-]+$/);
});

test('reel scrolls inside itself: wheel and arrow buttons', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  const reel = page.getByTestId('reel');
  await reel.scrollIntoViewIfNeeded();
  await expect(page.getByTestId('reel-card')).toHaveCount(20);
  expect(await reel.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  const left = page.getByRole('button', { name: 'Scroll past audits left' });
  const right = page.getByRole('button', { name: 'Scroll past audits right' });
  await expect(left).toBeDisabled();
  await right.click();
  await expect.poll(() => reel.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  await expect(left).toBeEnabled();
  // Wheel: vertical delta moves the reel sideways while it can still scroll that way.
  await reel.evaluate((el) => { el.style.scrollBehavior = 'auto'; el.scrollLeft = 0; });
  const y0 = await page.evaluate(() => scrollY);
  const box = (await reel.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => reel.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => scrollY)).toBe(y0);
});

test('main issues: six cards in impact order, linked to the item', async ({ page }) => {
  const expected = topIssues(getRepo(), ALL, 6);
  expect(expected).toHaveLength(6);
  await page.goto('/');
  const cards = page.getByTestId('issue-card');
  await expect(cards).toHaveCount(6);
  expect(await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-item')))).toEqual(expected.map((r) => r.itemCode));
  const top = expected[0];
  await expect(cards.first()).toHaveAttribute('href', `/category/${top.category}?q=all&r=SR1%2CSR2#item-${top.itemCode}`);
  await expect(cards.first()).toContainText(`noted in ${top.auditsHit} of ${top.auditsTotal} audits`);
  await expect(page.getByTestId('main-issues')).not.toContainText(/fail/i);
});

test('ten gap tiles below the hero, worst gap first', async ({ page }) => {
  await page.goto('/');
  const tiles = page.getByTestId('gap-tile');
  await expect(tiles).toHaveCount(10);
  const hero = (await page.getByTestId('hero').boundingBox())!;
  expect((await tiles.first().boundingBox())!.y).toBeGreaterThanOrEqual(hero.y + hero.height);
  const gaps = await tiles.evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-gap') ?? -1)));
  expect(gaps).toEqual([...gaps].sort((a, b) => b - a));
  await expect(tiles.first()).toHaveAttribute('href', /^\/category\/[a-z]+\?q=all&r=SR1%2CSR2$/);
});

for (const vp of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) test(`no horizontal document scroll at ${vp.width}`, async ({ page }) => {
  await page.setViewportSize(vp);
  await page.goto('/');
  await expect(page.getByTestId('reel-card')).toHaveCount(20);
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('text=NaN')).toHaveCount(0);
});

test('empty filter hides the sections below the hero', async ({ page }) => {
  await page.goto('/?q=Q4-2025&r=');
  await expect(page.getByTestId('empty-state')).toBeVisible();
  for (const id of ['reel-card', 'issue-card', 'gap-tile']) await expect(page.getByTestId(id)).toHaveCount(0);
  await expect(page.locator('text=NaN')).toHaveCount(0);
});
