import { test, expect } from '@playwright/test';
import { getRepo } from '../../lib/data/repo';
import { coverage, movers, regionDuel } from '../../lib/analytics';
import type { Filter } from '../../lib/types';

const ALL: Filter = { quarter: 'all', regions: ['SR1', 'SR2'] };

const hydrated = async (page: import('@playwright/test').Page) =>
  expect(page.getByTestId('contractors')).toHaveAttribute('data-hydrated', '');

for (const vp of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) test(`hero fits ${vp.width}`, async ({ page }) => {
  await page.setViewportSize(vp); await page.goto('/');
  for (const id of ['main-problem', 'kpi-regions', 'kpi-movers', 'kpi-coverage']) {
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
test('each row is one tap target to its contractor: no small icon buttons on the dashboard', async ({ page }) => {
  await page.goto('/');
  const row = page.getByTestId('contractor-row').first();
  await expect(row.getByRole('link')).toHaveAttribute('href', '/contractor/4800001131');
  await expect(page.getByTestId('hero').getByRole('button')).toHaveCount(0);
  await expect(page.getByTestId('card-chevron')).toHaveCount(0);
});
test('main problem names a category and links to its details', async ({ page }) => {
  await page.goto('/');
  const mp = page.getByTestId('main-problem');
  await expect(mp.getByRole('heading')).toHaveText('Subcontractor Control');
  await expect(mp.getByRole('link')).toHaveAttribute('href', '/category/subcontractor?q=all&r=SR1%2CSR2');
});
test('no rings: the only svg circles in the hero are sparkline points', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('contractor-row')).toHaveCount(12);
  const circles = page.getByTestId('hero').locator('svg circle');
  expect(await circles.count()).toBeGreaterThan(0);
  expect(await circles.evaluateAll((els) => els.every((e) => e.closest('[data-testid="spark"]') && e.getAttribute('data-testid') === 'spark-point'))).toBe(true);
});
test('theme toggle persists', async ({ page }) => { await page.goto('/'); await hydrated(page); await page.getByRole('button', { name: /theme/i }).click(); const t = await page.locator('html').getAttribute('data-theme'); await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme', t!); });
test('empty filter shows empty state', async ({ page }) => { await page.goto('/?q=Q4-2025&r='); await expect(page.getByTestId('empty-state')).toBeVisible(); await expect(page.locator('text=NaN')).toHaveCount(0); await expect(page.getByTestId('contractor-row')).toHaveCount(0); });
test('filter changes URL and numbers', async ({ page }) => {
  await page.goto('/'); await hydrated(page); await page.getByRole('button', { name: 'Q4 2025' }).click();
  await expect(page).toHaveURL(/q=Q4-2025/); await expect(page.getByTestId('contractor-row')).toHaveCount(8);
});
test('reduced motion renders bars at their final width', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' }); const page = await ctx.newPage();
  await page.goto('/');
  // read after hydration: before it, framer's server-rendered initial state can still be in place under load
  await expect(page.getByTestId('contractors')).toHaveAttribute('data-hydrated', '');
  const t = await page.getByTestId('contractor-row').first().locator('span[style*="width"]').first().evaluate((el) => getComputedStyle(el).transform);
  expect(t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)').toBe(true);
  await ctx.close();
});
test('main problem tile lifts on hover', async ({ page }) => {
  await page.goto('/'); await expect(page.getByTestId('contractors')).toHaveAttribute('data-hydrated', '');
  const mp = page.getByTestId('main-problem');
  await page.waitForTimeout(1200); // entrance done
  const y0 = (await mp.boundingBox())!.y;
  await mp.hover();
  await expect.poll(async () => y0 - (await mp.boundingBox())!.y).toBeGreaterThan(2);
});

test('the SR1 vs SR2 tile opens /audits with the filter', async ({ page }) => {
  await page.goto('/?q=Q1-2026&r=SR1');
  await hydrated(page);
  const link = page.getByTestId('kpi-regions').getByRole('link');
  await expect(link).toHaveAttribute('href', '/audits?q=Q1-2026&r=SR1');
  await link.click();
  await expect(page).toHaveURL(/\/audits\?q=Q1-2026&r=SR1$/);
});

test("SR1 vs SR2 tile: each side's average, base and the leader, same numbers as the analytics", async ({ page }) => {
  const d = regionDuel(getRepo(), ALL)!;
  await page.goto('/');
  const card = page.getByTestId('kpi-regions');
  await expect(card).toContainText('Q1 2026');
  for (const s of d.sides) {
    const side = card.locator(`[data-region="${s.region}"]`);
    await expect(side.getByTestId('region-score')).toHaveText(`${Math.round(s.score! * 100)}%`);
    await expect(side).toContainText(`${s.audits} audits · ${s.contractors} contractors`);
  }
  await expect(card.getByTestId('regions-leader')).toHaveText('SR2 ahead by 7 pts');
  await expect(card.getByTestId('regions-portfolio')).toHaveText('Portfolio 67%');
  await page.goto('/?q=all&r=SR1');
  await expect(card.getByTestId('region-side')).toHaveCount(1);
  await expect(card.getByTestId('regions-leader')).toHaveCount(0);
});

test('biggest movers: the biggest rise and fall since last quarter; rows open the contractor', async ({ page }) => {
  const m = movers(getRepo(), ALL);
  await page.goto('/');
  const card = page.getByTestId('kpi-movers');
  const rows = card.getByTestId('mover-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText(m.up[0].contractor.name);
  await expect(rows.nth(0)).toContainText('+14 pts');
  await expect(rows.nth(1)).toContainText(m.down[0].contractor.name);
  await expect(rows.nth(1)).toContainText('−6 pts');
  await expect(rows.nth(0).getByRole('link')).toHaveAttribute('href', `/contractor/${m.up[0].contractor.id}?q=all&r=SR1%2CSR2`);
  await page.goto('/?q=Q4-2025&r=SR1,SR2');
  await expect(card.getByTestId('movers-none')).toHaveText('No previous quarter to compare yet');
});

test("audits done: the quarter's audits, contractors audited per region and who is still waiting", async ({ page }) => {
  const c = coverage(getRepo(), ALL);
  await page.goto('/');
  const card = page.getByTestId('kpi-coverage');
  await expect(card.getByTestId('coverage-total')).toHaveText(String(c.regions.reduce((s, r) => s + r.audits, 0)));
  await expect(card.locator('[data-region="SR1"]')).toContainText('8 of 9 contractors');
  await expect(card.locator('[data-region="SR2"]')).toContainText('3 of 3 contractors');
  await expect(card.getByTestId('coverage-missing')).toHaveText('Waiting: Al-Biriki');
});

test('main problem reads "of points lost" beside the % and says better/worse than Q4 in words', async ({ page }) => {
  await page.goto('/');
  const mp = page.getByTestId('main-problem');
  await expect(mp.getByText('of points lost', { exact: true })).toBeVisible();
  await expect(mp.getByText('gap', { exact: true })).toHaveCount(0);
  await expect(mp).toContainText(/2 pts better\s*than Q4/);
});

test('no checklist codes anywhere in the hero', async ({ page }) => {
  for (const url of ['/', '/?q=Q1-2026&r=SR1,SR2', '/?q=Q4-2025&r=SR1,SR2']) {
    await page.goto(url);
    await expect(page.getByTestId('contractor-row').first()).toBeVisible();
    expect(await page.getByTestId('hero').textContent()).not.toMatch(/\b[ABC]\d+(\.\d+)?\b/);
  }
});

for (const vp of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) test(`one page: no vertical or horizontal page scroll at ${vp.width}`, async ({ page }) => {
  await page.setViewportSize(vp);
  await page.goto('/');
  await expect(page.getByTestId('contractor-row')).toHaveCount(12);
  await page.waitForTimeout(1500); // entrance done
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const id of ['main-issues', 'issue-card', 'reel', 'reel-card']) await expect(page.getByTestId(id)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /Recurring issues|Past audits/ })).toHaveCount(0);
  await expect(page.locator('text=NaN')).toHaveCount(0);
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

test('old category URLs redirect to Documents, keeping the query', async ({ page }) => {
  for (const old of ['permits', 'plans', 'rams']) {
    await page.goto(`/category/${old}?q=Q1-2026&r=SR1`);
    await expect(page).toHaveURL(/\/category\/documents\?q=Q1-2026&r=SR1$/);
    await expect(page.getByTestId('carousel')).toBeVisible();
  }
});

test('light theme: the orange bar fill is at least 3:1 on the white card (graphics contrast)', async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: 'light', viewport: { width: 1366, height: 768 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('theme', 'light'); } catch { /* private mode */ } });
  const page = await ctx.newPage();
  await page.goto('/');
  const ratio = await page.evaluate(() => {
    const cv = document.createElement('canvas').getContext('2d')!;
    const rgb = (c: string) => { cv.fillStyle = '#000'; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); return [...cv.getImageData(0, 0, 1, 1).data].slice(0, 3); };
    const lum = (c: number[]) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const card = lum(rgb(getComputedStyle(document.querySelector('[data-testid="kpi-coverage"]')!).backgroundColor));
    const bar = lum(rgb(getComputedStyle(document.documentElement).getPropertyValue('--minimal-dot').trim()));
    return (Math.max(bar, card) + 0.05) / (Math.min(bar, card) + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(3);
  await ctx.close();
});
