import { test, expect } from '@playwright/test';
import { getRepo } from '../../lib/data/repo';
import { followUps, positiveSummary, regionComparison, repeatFindings, repeatQuestions } from '../../lib/analytics';
import type { Filter } from '../../lib/types';

const ALL: Filter = { quarter: 'all', regions: ['SR1', 'SR2'] };
import { pct } from '../../lib/format';

const hydrated = async (page: import('@playwright/test').Page) =>
  expect(page.getByTestId('contractors')).toHaveAttribute('data-hydrated', '');

for (const vp of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) test(`hero fits ${vp.width}`, async ({ page }) => {
  await page.setViewportSize(vp); await page.goto('/');
  await expect(page.getByTestId('score-ring')).toBeVisible();
  for (const id of ['main-problem', 'kpi-score', 'kpi-repeats', 'kpi-positives', 'kpi-bands', 'region-compare']) {
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
  // read after hydration: before it, framer's server-rendered initial state can still be in place under load
  await expect(page.getByTestId('contractors')).toHaveAttribute('data-hydrated', '');
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

test('the positives tile opens /positives with the filter', async ({ page }) => {
  await page.goto('/?q=Q1-2026&r=SR1');
  await hydrated(page);
  const link = page.getByTestId('kpi-positives').getByRole('link');
  await expect(link).toHaveAttribute('href', '/positives?q=Q1-2026&r=SR1');
  await link.click();
  await expect(page).toHaveURL(/\/positives\?q=Q1-2026&r=SR1$/);
  await expect(page.getByTestId('positives-header')).toBeVisible();
});

test('repeats card: findings noted again at the next audit, and what they are made of', async ({ page }) => {
  const repo = getRepo();
  const count = (f: Filter) => repeatFindings(repo, f).length;
  expect(count(ALL)).toBe(345);
  await page.goto('/');
  const card = page.getByTestId('kpi-repeats');
  await expect(card.getByTestId('repeats-count')).toHaveText('345');
  await expect(card.getByTestId('repeats-rule')).toHaveText("same question noted again at the contractor's next audit");
  await expect(card.getByTestId('repeats-questions')).toHaveText(`${repeatQuestions(repo, ALL).length} questions`);
  await expect(card.getByTestId('repeats-contractors')).toHaveText('7 contractors');
  await expect(card.getByTestId('repeats-followups')).toHaveText(`${followUps(repo, ALL).length} follow-up audits`);
  // Q4 has a follow-up too (SIBS, audited twice in November): never "—" while a pair exists
  await page.goto('/?q=Q4-2025&r=SR1,SR2');
  await expect(card.getByTestId('repeats-count')).toHaveText(String(count({ ...ALL, quarter: 'Q4-2025' })));
  await expect(card.getByTestId('repeats-contractors')).toHaveText('1 contractor');
  for (const r of ['SR1', 'SR2'] as const) {
    await page.goto(`/?q=all&r=${r}`);
    await expect(card.getByTestId('repeats-count')).toHaveText(String(count({ quarter: 'all', regions: [r] })));
  }
});

test('positives card: total, coverage of audits and contractors', async ({ page }) => {
  const s = positiveSummary(getRepo(), ALL);
  expect(s.total).toBe(138);
  await page.goto('/');
  const card = page.getByTestId('kpi-positives');
  await expect(card.getByTestId('positives-count')).toHaveText('138');
  await expect(card.getByTestId('positives-coverage')).toHaveText(`${s.auditsWith} of ${s.audits} audits · ${s.contractorsWith} of ${s.contractors} contractors`);
  await page.goto('/?q=Q4-2025&r=SR1,SR2');
  await expect(card.getByTestId('positives-count')).toHaveText(String(positiveSummary(getRepo(), { ...ALL, quarter: 'Q4-2025' }).total));
});

test('main problem reads "score lost" beside the %', async ({ page }) => {
  await page.goto('/');
  const mp = page.getByTestId('main-problem');
  await expect(mp.getByText('score lost', { exact: true })).toBeVisible();
  await expect(mp.getByText('gap', { exact: true })).toHaveCount(0);
  await expect(mp).toContainText(/vs Q4/);
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
    const card = lum(rgb(getComputedStyle(document.querySelector('[data-testid="kpi-repeats"]')!).backgroundColor));
    const bar = lum(rgb(getComputedStyle(document.documentElement).getPropertyValue('--minimal-dot').trim()));
    return (Math.max(bar, card) + 0.05) / (Math.min(bar, card) + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(3);
  await ctx.close();
});
