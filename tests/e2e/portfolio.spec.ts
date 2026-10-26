import { test, expect } from '@playwright/test';
import { getRepo } from '../../lib/data/repo';
import { regionComparison } from '../../lib/analytics';
import { pct } from '../../lib/format';

const hydrated = async (page: import('@playwright/test').Page) =>
  expect(page.getByTestId('contractors')).toHaveAttribute('data-hydrated', '');

for (const vp of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) test(`hero fits ${vp.width}`, async ({ page }) => {
  await page.setViewportSize(vp); await page.goto('/');
  await expect(page.getByTestId('score-ring')).toBeVisible();
  for (const id of ['main-problem', 'kpi-score', 'kpi-repeats', 'kpi-highrisk', 'kpi-bands', 'region-compare']) {
    await expect(page.getByTestId(id)).toBeInViewport({ ratio: 1 });
  }
  await expect(page.getByTestId('contractor-row')).toHaveCount(12);
  await expect(page.getByTestId('contractor-row').last()).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const box = await page.getByTestId('hero').boundingBox(); expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height + 1);
});
test('contractor rows are ranked by score, highest first', async ({ page }) => {
  await page.goto('/');
  const scores = (await page.getByTestId('contractor-row').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-score')))));
  expect(scores).toHaveLength(12);
  expect(scores).toEqual([...scores].sort((a, b) => b - a));
});
test('each row links to its contractor and has a compare toggle', async ({ page }) => {
  await page.goto('/');
  const row = page.getByTestId('contractor-row').first();
  await expect(row.getByRole('link')).toHaveAttribute('href', '/contractor/4800001131');
  await expect(row.getByRole('button', { name: 'Compare JV-ECH (Port T1)' })).toBeVisible();
});
test('main problem names a category and links to its details', async ({ page }) => {
  await page.goto('/');
  const mp = page.getByTestId('main-problem');
  await expect(mp.getByRole('heading')).toHaveText('Subcontractor Control');
  await expect(mp.getByRole('link')).toHaveAttribute('href', '/category/subcontractor?q=all&r=SR1%2CSR2');
});
test('no rings: the hero holds no svg circles', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('contractor-row')).toHaveCount(12);
  await expect(page.getByTestId('hero').locator('svg circle')).toHaveCount(0);
});
test('theme toggle persists', async ({ page }) => { await page.goto('/'); await hydrated(page); await page.getByRole('button', { name: /theme/i }).click(); const t = await page.locator('html').getAttribute('data-theme'); await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme', t!); });
test('empty filter shows empty state', async ({ page }) => { await page.goto('/?q=Q4-2025&r='); await expect(page.getByTestId('empty-state')).toBeVisible(); await expect(page.locator('text=NaN')).toHaveCount(0); await expect(page.getByTestId('contractor-row')).toHaveCount(0); });
test('filter changes URL and numbers', async ({ page }) => {
  await page.goto('/'); await hydrated(page); await page.getByRole('button', { name: 'Q4 2025' }).click();
  await expect(page).toHaveURL(/q=Q4-2025/); await expect(page.getByTestId('contractor-row')).toHaveCount(8);
});
test('portfolio delta names its baseline', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('kpi-score-delta')).toHaveText(/^Q1 vs Q4\s*[+−±]\d+ pts?$/);
  await page.goto('/?q=Q1-2026&r=SR1,SR2');
  await expect(page.getByTestId('kpi-score-delta')).toHaveText(/^[+−±]\d+ pts?\s*vs Q4 2025$/);
});
test('reduced motion renders bars at their final width', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' }); const page = await ctx.newPage();
  await page.goto('/');
  const t = await page.getByTestId('contractor-row').first().locator('span[style*="width"]').first().evaluate((el) => getComputedStyle(el).transform);
  expect(t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)').toBe(true);
  await ctx.close();
});
test('region tile follows the quarter filter', async ({ page }) => {
  const filter = { quarter: 'Q4-2025' as const, regions: ['SR1', 'SR2'] as ('SR1' | 'SR2')[] };
  const expected = regionComparison(getRepo(), filter).map((r) => ({ region: r.region, v: pct(r.byQuarter['Q4-2025']) }));
  expect(expected.map((e) => e.v)).toEqual(['64', '70']);
  await page.goto('/?q=Q4-2025&r=SR1,SR2');
  const tile = page.getByTestId('region-compare');
  for (const e of expected) {
    await expect(tile.locator(`[data-testid="region-row"][data-region="${e.region}"]`).getByTestId('region-value')).toHaveText(`${e.v}%`);
  }
  await expect(tile.getByTestId('region-scope')).toHaveText('Q4 2025');
  await page.goto('/?q=Q1-2026&r=SR1,SR2');
  await expect(tile.getByTestId('region-scope')).toHaveText('Q1 2026 · Δ vs Q4');
  await expect(tile.locator('[data-region="SR1"]').getByTestId('region-value')).toHaveText(`${pct(regionComparison(getRepo(), { ...filter, quarter: 'Q1-2026' })[0].byQuarter['Q1-2026'])}%`);
});
test('main problem tile lifts on hover', async ({ page }) => {
  await page.goto('/'); await expect(page.getByTestId('contractors')).toHaveAttribute('data-hydrated', '');
  const mp = page.getByTestId('main-problem');
  await page.waitForTimeout(1200); // entrance done
  const y0 = (await mp.boundingBox())!.y;
  await mp.hover();
  await expect.poll(async () => y0 - (await mp.boundingBox())!.y).toBeGreaterThan(2);
});

test('the high-risk tile opens Permits & High-Risk Work with the filter', async ({ page }) => {
  await page.goto('/?q=Q1-2026&r=SR1');
  await hydrated(page);
  const link = page.getByTestId('kpi-highrisk').getByRole('link');
  await expect(link).toHaveAttribute('href', '/category/permits?q=Q1-2026&r=SR1');
  await link.click();
  await expect(page).toHaveURL(/\/category\/permits\?q=Q1-2026&r=SR1$/);
  await expect(page.getByTestId('carousel')).toBeVisible();
});

test('repeat rows link to the repeated item', async ({ page }) => {
  await page.goto('/');
  await hydrated(page);
  await expect(page.getByTestId('kpi-repeats')).toContainText('noted again in a later quarter');
  await expect(page.getByTestId('kpi-repeats')).not.toContainText(/fail/i);
  const rows = page.getByTestId('repeat-row');
  await expect(rows).toHaveCount(3);
  for (const h of await rows.evaluateAll((els) => els.map((e) => e.getAttribute('href')!))) {
    expect(h).toMatch(/^\/category\/[a-z]+(\/\d{10}\/[\w.%]+\?q=all&r=SR1%2CSR2|\?q=all&r=SR1%2CSR2#item-[\w.]+)$/);
  }
  const first = (await rows.first().getAttribute('href'))!;
  await rows.first().click();
  await expect(page).toHaveURL(first);
  if (first.includes('#item-')) {
    await expect(page.getByTestId('carousel')).toHaveAttribute('data-ready', '');
    await expect(page.locator('[data-testid="slide"][data-active]').locator(`[id="item-${first.split('#item-')[1]}"]`)).toBeAttached();
  } else {
    await expect(page.getByTestId('item-timeline')).toBeVisible();
  }
});

test('reduced motion only strips hover/press motion utilities, never positioning translates', async ({ page }) => {
  await page.goto('/');
  // selectors of every rule that sets `translate: none` inside a prefers-reduced-motion block
  const selectors = await page.evaluate(() => {
    const out: string[] = [];
    const walk = (rules: CSSRuleList, inReduce: boolean) => {
      for (const r of Array.from(rules)) {
        if (r instanceof CSSMediaRule) walk(r.cssRules, inReduce || /prefers-reduced-motion/.test(r.conditionText));
        else if (r instanceof CSSStyleRule && inReduce && r.style.getPropertyValue('translate') === 'none') out.push(...r.selectorText.split(',').map((x) => x.trim()));
      }
    };
    for (const sh of Array.from(document.styleSheets)) { try { walk(sh.cssRules, false); } catch { /* cross-origin */ } }
    return out;
  });
  expect(selectors.length).toBeGreaterThan(0);
  for (const sel of selectors) expect(sel).toMatch(/\[class\*="(group-)?hover:-?translate"\]|\[class\*="(active|hover):scale"\]/);
});
