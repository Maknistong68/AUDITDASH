import { test, expect } from '@playwright/test';
import { getRepo } from '../../lib/data/repo';
import { deltaPoints } from '../../lib/format';
import { expectNothingClipped } from './clip';

/**
 * Owner direction §21 "only what the Excel can tell us": no keyword-inferred high-risk work, one Portfolio score card
 * (bands and regions live on /audits only), and small up/down charts in place of "+1 / −2" text.
 */
const repo = getRepo();
const NAME = new Map(repo.contractors().map((c) => [c.name, c.id]));
/** Every audit score of a contractor in date order (both regions, all quarters), as whole %. */
const scores = (id: string) =>
  repo.audits().filter((a) => a.contractorId === id).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).map((a) => a.totalScore);
const trend = (v: number[]) => {
  if (v.length < 2) return 'single';
  const d = deltaPoints(v[v.length - 1], v[v.length - 2])!;
  return d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
};
const row = (page: import('@playwright/test').Page, id: string) =>
  page.getByTestId('contractor-row').filter({ has: page.locator(`a[href^="/contractor/${id}"]`) });

test('no high-risk card on the dashboard, and old /high-risk links redirect (308) to the overview', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByTestId('contractor-row')).toHaveCount(12);
  for (const id of ['kpi-high-risk', 'high-risk', 'kpi-highrisk']) await expect(page.getByTestId(id)).toHaveCount(0);
  await expect(page.getByTestId('hero')).not.toContainText(/high-risk|high risk|open actions/i);
  for (const url of ['/high-risk', '/high-risk/working-at-height']) {
    const res = await request.get(url, { maxRedirects: 0 });
    expect(res.status(), url).toBe(308);
    expect(res.headers()['location'], url).toBe('/');
  }
  await page.goto('/high-risk?q=Q1-2026&r=SR1');
  await expect(page).toHaveURL(/\/\?q=Q1-2026&r=SR1$/);
  await expect(page.getByTestId('kpi-regions')).toBeVisible();
});

test('the dashboard has the director tiles and no band card; repeats and positives live on their own pages', async ({ page }) => {
  await page.goto('/');
  for (const id of ['kpi-regions', 'kpi-movers', 'kpi-coverage']) await expect(page.getByTestId(id)).toHaveCount(1);
  for (const id of ['kpi-bands', 'kpi-score', 'kpi-repeats', 'kpi-positives']) await expect(page.getByTestId(id)).toHaveCount(0);
  await expect(page.getByTestId('hero').locator('section.card')).toHaveCount(4); // contractors, SR1 vs SR2, movers, audits done (the main problem is the dark hero tile)
});

test('/audits is the home of the timeline, the bands and the regions', async ({ page }) => {
  await page.goto('/audits?q=all&r=SR1%2CSR2');
  await expect(page.getByTestId('audits-timeline')).toBeVisible();
  await expect(page.getByTestId('audits-bands')).toBeVisible();
  await expect(page.getByTestId('audits-regions')).toBeVisible();
  await expect(page.getByTestId('region-quarter-bar')).toHaveCount(4);
});

test('each contractor row has a sparkline of its audit scores, coloured up/down, no "+N" text', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('contractor-row')).toHaveCount(12);
  await expect(page.getByTestId('spark')).toHaveCount(12);
  // the named cases
  const jv = row(page, NAME.get('JV-ECH (Port T1)')!).getByTestId('spark');
  await expect(jv).toHaveAttribute('data-points', '2');
  await expect(jv).toHaveAttribute('data-trend', 'up');
  await expect(jv).toHaveAttribute('aria-label', '74% → 85%');
  const nbc = row(page, NAME.get('NBC')!).getByTestId('spark');
  await expect(nbc).toHaveAttribute('data-points', '1');
  await expect(nbc).toHaveAttribute('data-trend', 'single');
  await expect(nbc.getByTestId('spark-point')).toHaveCount(1);
  // every row: points = its audits, trend from the last two, colour from the trend
  const colours = await page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    const rgb = (c: string) => { const d = document.createElement('div'); d.style.color = c; document.body.append(d); const v = getComputedStyle(d).color; d.remove(); return v; };
    return { up: rgb(css.getPropertyValue('--up').trim()), down: rgb(css.getPropertyValue('--down').trim()), muted: rgb(css.getPropertyValue('--muted').trim()) };
  });
  let seen = { up: 0, down: 0, single: 0 } as Record<string, number>;
  for (const [, id] of NAME) {
    const v = scores(id);
    const spark = row(page, id).getByTestId('spark');
    const t = trend(v);
    seen = { ...seen, [t]: (seen[t] ?? 0) + 1 };
    await expect(spark).toHaveAttribute('data-points', String(v.length));
    await expect(spark).toHaveAttribute('data-trend', t);
    await expect(spark.getByTestId('spark-point')).toHaveCount(v.length);
    const fills = await spark.getByTestId('spark-point').evaluateAll((els) => els.map((e) => getComputedStyle(e).fill));
    const want = t === 'up' ? colours.up : t === 'down' ? colours.down : colours.muted;
    for (const f of fills) expect(f).toBe(want);
    // the endpoint dot is the emphasised one
    const r = await spark.getByTestId('spark-point').evaluateAll((els) => els.map((e) => Number(e.getAttribute('r'))));
    expect(r.at(-1)).toBe(Math.max(...r));
    const box = (await spark.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(48);
    expect(box.width).toBeLessThanOrEqual(64);
  }
  expect(seen.up).toBeGreaterThan(0);
  expect(seen.down).toBeGreaterThan(0);
  expect(seen.single).toBeGreaterThan(0);
  // no "↑ +11 / ↓ −2" text left in the list
  expect(await page.getByTestId('contractors').innerText()).not.toMatch(/[+−]\d+/);
});

test('the sparkline follows the region filter and ignores the quarter filter', async ({ page }) => {
  await page.goto('/?q=Q1-2026&r=SR2');
  const jv = row(page, NAME.get('JV-ECH (Port T1)')!).getByTestId('spark');
  await expect(jv).toHaveAttribute('data-points', '2');
  await page.goto('/?q=all&r=SR1');
  await expect(row(page, NAME.get('JV-ECH (Port T1)')!)).toHaveCount(0);
  await expect(row(page, NAME.get('NBC')!).getByTestId('spark')).toHaveAttribute('data-points', '1');
});

for (const vp of [{ width: 1366, height: 768 }, { width: 1366, height: 657 }, { width: 1920, height: 1080 }]) {
  test(`one screen at ${vp.width}×${vp.height}: nothing clipped, no page scroll, every card in view`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: vp, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.getByTestId('contractor-row')).toHaveCount(12);
    await expectNothingClipped(page, `/ at ${vp.width}×${vp.height}`);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    for (const id of ['contractors', 'main-problem', 'kpi-regions', 'kpi-movers', 'kpi-coverage']) {
      await expect(page.getByTestId(id)).toBeInViewport({ ratio: 1 });
    }
    await expect(page.getByTestId('contractor-row').last()).toBeInViewport({ ratio: 1 });
    await ctx.close();
  });
}
