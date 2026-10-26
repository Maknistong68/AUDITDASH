import { test, expect } from '@playwright/test';

for (const vp of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) test(`hero fits ${vp.width}`, async ({ page }) => {
  await page.setViewportSize(vp); await page.goto('/');
  await expect(page.getByTestId('score-ring')).toBeVisible();
  for (const id of ['kpi-score', 'kpi-bands', 'kpi-repeats', 'kpi-highrisk']) await expect(page.getByTestId(id)).toBeVisible();
  await expect(page.getByTestId('contractor-card')).toHaveCount(12);
  await expect(page.getByTestId('contractor-card').last()).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const box = await page.getByTestId('hero').boundingBox(); expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height + 1);
});
test('each card links to its contractor and has a compare toggle', async ({ page }) => {
  await page.goto('/');
  const card = page.getByTestId('contractor-card').first();
  await expect(card.getByRole('link')).toHaveAttribute('href', '/contractor/4800001131');
  await expect(card.getByRole('button', { name: 'Compare JV-ECH (Port T1)' })).toBeVisible();
});
test('theme toggle persists', async ({ page }) => { await page.goto('/'); await expect(page.getByTestId('scoreboard')).toHaveAttribute('data-hydrated', ''); await page.getByRole('button', { name: /theme/i }).click(); const t = await page.locator('html').getAttribute('data-theme'); await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme', t!); });
test('empty filter shows empty state', async ({ page }) => { await page.goto('/?q=Q4-2025&r='); await expect(page.getByTestId('empty-state')).toBeVisible(); await expect(page.locator('text=NaN')).toHaveCount(0); await expect(page.getByTestId('contractor-card')).toHaveCount(0); });
test('filter changes URL and numbers', async ({ page }) => {
  await page.goto('/'); await expect(page.getByTestId('scoreboard')).toHaveAttribute('data-hydrated', ''); await page.getByRole('button', { name: 'Q4 2025' }).click();
  await expect(page).toHaveURL(/q=Q4-2025/); await expect(page.getByTestId('contractor-card')).toHaveCount(8);
});
test('reduced motion renders rings at their final values', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' }); const page = await ctx.newPage();
  await page.goto('/');
  const arcs = page.getByTestId('contractor-card').first().getByTestId('ring-arc');
  await expect(arcs).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    const arc = arcs.nth(i);
    const [target, circ, offset] = await arc.evaluate((el) => [Number(el.getAttribute('data-value')), Number(el.getAttribute('data-circ')), parseFloat(getComputedStyle(el).strokeDashoffset)]);
    expect(target).toBeGreaterThan(0);
    expect(Math.abs(offset - circ * (1 - target))).toBeLessThan(0.5);
  }
  await ctx.close();
});
test('portfolio delta names its baseline', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('kpi-score-delta')).toHaveText(/^Q1 vs Q4\s*[+−±]\d+ pts?$/);
  await page.goto('/?q=Q1-2026&r=SR1,SR2');
  await expect(page.getByTestId('kpi-score-delta')).toHaveText(/^[+−±]\d+ pts?\s*vs Q4 2025$/);
});
