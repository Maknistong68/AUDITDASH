import { test, expect } from '@playwright/test';

for (const vp of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) test(`hero fits ${vp.width}`, async ({ page }) => {
  await page.setViewportSize(vp); await page.goto('/');
  await expect(page.getByTestId('score-ring')).toBeVisible();
  await expect(page.getByTestId('gap-tile')).toHaveCount(10);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const box = await page.getByTestId('hero').boundingBox(); expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height + 1);
});
test('theme toggle persists', async ({ page }) => { await page.goto('/'); await page.getByRole('button', { name: /theme/i }).click(); const t = await page.locator('html').getAttribute('data-theme'); await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme', t!); });
test('empty filter shows empty state', async ({ page }) => { await page.goto('/?q=Q4-2025&r='); await expect(page.getByTestId('empty-state')).toBeVisible(); await expect(page.locator('text=NaN')).toHaveCount(0); });
test('filter changes URL and numbers', async ({ page }) => { await page.goto('/'); await page.getByRole('button', { name: 'Q1 2026' }).click(); await expect(page).toHaveURL(/q=Q1-2026/); });
test('hovering a gap row reveals at most 3 contractor chips', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 }); await page.goto('/');
  const row = page.getByTestId('gap-tile').first();
  const chips = row.getByTestId('gap-chip');
  await expect(chips.first()).toBeHidden();
  await row.hover();
  await expect(chips.first()).toBeVisible();
  const n = await chips.count(); expect(n).toBeGreaterThan(0); expect(n).toBeLessThanOrEqual(3);
});
