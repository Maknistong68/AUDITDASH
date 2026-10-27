import { test, expect, type Page } from '@playwright/test';
import { getRepo } from '../../lib/data/repo';
import { bandDistribution, filterAudits } from '../../lib/analytics';
import { timelineRows } from '../../lib/timeline';

const ALL = { quarter: 'all' as const, regions: ['SR1', 'SR2'] as ('SR1' | 'SR2')[] };
const Q = 'q=all&r=SR1%2CSR2';
const ROWS = timelineRows(filterAudits(getRepo(), ALL), getRepo().contractors());
const CODE = /\b[ABC]\d+(\.\d+)?\b/;

/** Wrap startViewTransition: count hand-offs and, once each is running, record its pseudo-element animation durations. */
async function watchTransitions(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { handoffs: number; durations: Record<string, number> };
    w.handoffs = 0;
    w.durations = {};
    const start = document.startViewTransition.bind(document);
    document.startViewTransition = ((cb: ViewTransitionUpdateCallback) => {
      w.handoffs++;
      const t = start(cb);
      t.ready.then(() => {
        for (const a of document.getAnimations()) {
          const pe = (a.effect as KeyframeEffect | null)?.pseudoElement;
          if (pe) w.durations[pe] = Number(a.effect!.getComputedTiming().duration);
        }
      });
      return t;
    }) as typeof document.startViewTransition;
  });
}
const transitions = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { handoffs: number; durations: Record<string, number> };
    return { handoffs: w.handoffs, durations: w.durations };
  });

async function noPageScroll(page: Page) {
  const [sh, ih, sw, iw] = await page.evaluate(() => [
    document.documentElement.scrollHeight, innerHeight, document.documentElement.scrollWidth, innerWidth,
  ]);
  expect(sh).toBeLessThanOrEqual(ih);
  expect(sw).toBeLessThanOrEqual(iw);
}

const rowIds = (page: Page) => page.getByTestId('audits-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')));

test('the Portfolio score card opens /audits with a ~1 s shared hand-off; the header shows 67%', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  const card = page.getByTestId('kpi-score');
  await expect(card.getByTestId('card-chevron')).toHaveCount(1);
  await watchTransitions(page);
  await card.getByRole('link').click();
  await expect(page).toHaveURL(new RegExp(`/audits\\?${Q}$`));
  await expect(page.getByTestId('audits-figure')).toHaveText('67%');
  await expect(page.getByTestId('audits-band')).toHaveText('Minimal');
  await expect(page.getByTestId('audits-count')).toHaveText('20');
  await expect(page.getByTestId('breadcrumb')).toHaveText(/Overview\s*Portfolio/);
  await expect.poll(async () => Object.keys((await transitions(page)).durations).length).toBeGreaterThan(0);
  const { handoffs, durations } = await transitions(page);
  expect(handoffs).toBe(1);
  // the card grows into the header strip and the 67% flies into the header figure, each about 1 s
  expect(durations['::view-transition-group(ps-card)']).toBeGreaterThanOrEqual(900);
  expect(durations['::view-transition-group(ps-figure)']).toBeGreaterThanOrEqual(900);
  expect(durations['::view-transition-group(ps-card)']).toBeLessThanOrEqual(1100);
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter((a) => (a.effect as KeyframeEffect | null)?.pseudoElement).length)).toBe(0);
});

for (const [focus, panel] of [['bands', 'audits-bands'], ['regions', 'audits-regions']] as const) {
  test(`/audits?focus=${focus} highlights its panel briefly`, async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`/audits?${Q}&focus=${focus}`);
    await expect(page.getByTestId(panel)).toHaveAttribute('data-focused', 'true');
    await expect(page.getByTestId(panel)).toHaveClass(/ps-focus/);
    const other = panel === 'audits-bands' ? 'audits-regions' : 'audits-bands';
    await expect(page.getByTestId(other)).not.toHaveAttribute('data-focused', 'true');
    await expect(page.getByTestId('audits-figure')).toHaveText('67%');
    // the highlight is brief
    await expect(page.getByTestId(panel)).not.toHaveAttribute('data-focused', 'true', { timeout: 6000 });
  });
}

test('filter all: 12 contractor rows (worst latest first) and 20 audit dots; lines green only when the score rose', async ({ page }) => {
  await page.goto(`/audits?${Q}`);
  await expect(page.getByTestId('audits-row')).toHaveCount(12);
  await expect(page.getByTestId('audit-dot')).toHaveCount(20);
  expect(await rowIds(page)).toEqual(ROWS.map((r) => r.id));
  await expect(page.getByTestId('audits-quarter-value')).toHaveText(['66%', '67%']);
  await expect(page.getByTestId('audits-delta')).toContainText('+1');
  // 20 audits over 12 contractors: 8 lines
  await expect(page.getByTestId('audit-line')).toHaveCount(8);
  for (const row of await page.getByTestId('audits-row').all()) {
    const scores = (await row.getByTestId('audit-dot').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-score')))));
    const trends = await row.getByTestId('audit-line').evaluateAll((els) => els.map((e) => e.getAttribute('data-trend')));
    trends.forEach((t, k) => expect(t).toBe(scores[k + 1] > scores[k] ? 'up' : scores[k + 1] < scores[k] ? 'down' : 'flat'));
  }
  // dots are placed by date: the first contractor's Q4 dot sits left of its Q1 dot, and the Q4 half is on the left
  const xs = await page.getByTestId('audit-dot').evaluateAll((els) =>
    els.map((e) => ({ date: e.getAttribute('data-date')!, x: e.getBoundingClientRect().x })));
  const q4 = xs.filter((d) => d.date < '2026').map((d) => d.x);
  const q1 = xs.filter((d) => d.date >= '2026').map((d) => d.x);
  expect(Math.max(...q4)).toBeLessThan(Math.min(...q1));
  await expect(page.getByTestId('audits-axis-quarter')).toHaveText(['Q4 2025', 'Q1 2026']);
});

for (const [w, h] of [[1366, 768], [1920, 1080]] as const) {
  test(`/audits at ${w}×${h}: one screen, every row and dot visible, no codes`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`/audits?${Q}`);
    await expect(page.getByTestId('audits-timeline')).toBeVisible();
    await noPageScroll(page);
    for (const row of await page.getByTestId('audits-name').all()) await expect(row).toBeInViewport({ ratio: 1 });
    for (const dot of await page.getByTestId('audit-dot').all()) await expect(dot).toBeInViewport({ ratio: 1 });
    for (const b of await page.getByTestId('band-filter').all()) await expect(b).toBeInViewport({ ratio: 1 });
    for (const r of await page.getByTestId('region-filter').all()) await expect(r).toBeInViewport({ ratio: 1 });
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(CODE);
    expect(text).not.toMatch(/NaN|undefined|Infinity/);
  });
}

test('hovering a dot shows its date, score and band; a click opens its report with the filter', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`/audits?${Q}`);
  const dot = page.locator('[data-testid="audit-dot"][data-id="4800001272-Q4-2025-20251029"]');
  await dot.hover();
  const tip = page.getByTestId('audit-tooltip');
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('29 Oct 2025');
  await expect(tip).toContainText('71%');
  await expect(tip).toContainText('Partial');
  await dot.click();
  await expect(page).toHaveURL(new RegExp(`/audit/4800001272-Q4-2025-20251029\\?${Q}$`));
  await expect(page.getByTestId('report-total')).toHaveText('71%');
});

test('a contractor name opens the contractor with the filter', async ({ page }) => {
  await page.goto(`/audits?${Q}`);
  const first = page.getByTestId('audits-row').first();
  const id = await first.getAttribute('data-id');
  await first.getByTestId('audits-name').click();
  await expect(page).toHaveURL(new RegExp(`/contractor/${id}\\?${Q}$`));
});

test('a band click filters the rows and sets band; a reload keeps it; a second click clears it', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`/audits?${Q}`);
  const counts = bandDistribution(getRepo(), ALL);
  const partial = page.locator('[data-testid="band-filter"][data-band="partial"]');
  await expect(partial).toHaveAttribute('data-count', String(counts['Partially Compliant']));
  await partial.click();
  await expect(page).toHaveURL(new RegExp(`/audits\\?${Q}&band=partial$`));
  await expect(partial).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('band-chip')).toContainText('Partial');
  const want = ROWS.filter((r) => r.latestBand === 'Partially Compliant').map((r) => r.id);
  await expect.poll(() => rowIds(page)).toEqual(want);
  await page.reload();
  await expect.poll(() => rowIds(page)).toEqual(want);
  await page.locator('[data-testid="band-filter"][data-band="partial"]').click();
  await expect(page).toHaveURL(new RegExp(`/audits\\?${Q}$`));
  await expect(page.getByTestId('audits-row')).toHaveCount(12);
  // empty bands cannot be picked
  await expect(page.locator('[data-testid="band-filter"][data-band="excellent"]')).toBeDisabled();
});

test('a region click sets r= like the filter bar; a second click shows both again', async ({ page }) => {
  await page.goto(`/audits?${Q}`);
  await expect(page.getByTestId('region-quarter-value')).toHaveText(['64%', '65%', '70%', '72%']);
  await page.locator('[data-testid="region-filter"][data-region="SR2"]').click();
  await expect(page).toHaveURL(/\/audits\?q=all&r=SR2$/);
  await expect(page.locator('[data-testid="region-filter"][data-region="SR2"]')).toHaveAttribute('aria-pressed', 'true');
  const sr2 = timelineRows(filterAudits(getRepo(), { ...ALL, regions: ['SR2'] }), getRepo().contractors());
  await expect(page.getByTestId('audits-row')).toHaveCount(sr2.length);
  await expect(page.getByRole('group', { name: 'Sub-region' }).getByRole('button', { name: 'SR1' })).toHaveAttribute('aria-pressed', 'false');
  await page.locator('[data-testid="region-filter"][data-region="SR2"]').click();
  await expect(page).toHaveURL(/\/audits\?q=all&r=SR1%2CSR2$/);
  await expect(page.getByTestId('audits-row')).toHaveCount(12);
});

test('/audits: Esc returns to the overview with the filter', async ({ page }) => {
  await page.goto('/audits?q=Q1-2026&r=SR1');
  await expect(page.locator('body[data-esc-ready]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/\?q=Q1-2026&r=SR1$/);
});

test('reduced motion: the Portfolio card still navigates, with no transition', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await page.goto('/');
  await watchTransitions(page);
  await page.getByTestId('kpi-score').getByRole('link').click();
  await expect(page).toHaveURL(new RegExp(`/audits\\?${Q}$`));
  await expect(page.getByTestId('audits-figure')).toHaveText('67%');
  expect((await transitions(page)).handoffs).toBe(0);
  await ctx.close();
});

test('Q4 only: one quarter column, one bar, Q4 dots only', async ({ page }) => {
  const f = { ...ALL, quarter: 'Q4-2025' as const };
  const audits = filterAudits(getRepo(), f);
  await page.goto('/audits?q=Q4-2025&r=SR1%2CSR2');
  await expect(page.getByTestId('audits-axis-quarter')).toHaveText(['Q4 2025']);
  await expect(page.getByTestId('audits-quarter-bar')).toHaveCount(1);
  await expect(page.getByTestId('audits-delta')).toHaveCount(0);
  await expect(page.getByTestId('audit-dot')).toHaveCount(audits.length);
  await expect(page.getByTestId('audits-row')).toHaveCount(new Set(audits.map((a) => a.contractorId)).size);
  await expect(page.getByTestId('region-quarter-bar')).toHaveCount(2);
  expect(await page.locator('main').innerText()).not.toMatch(/NaN|undefined|Infinity/);
  await noPageScroll(page);
});

test('/audits under a non-H&S type, an empty filter or an empty band: calm empty state, no NaN', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  for (const url of ['/audits?q=all&r=SR1%2CSR2&t=security', '/audits?q=all&r=']) {
    await page.goto(url);
    await expect(page.getByTestId('audits-figure')).toHaveText('—');
    await expect(page.getByTestId('empty-state')).toContainText('No audits match this filter');
    await expect(page.getByTestId('audits-timeline')).toHaveCount(0);
    await expect(page.getByTestId('audits-quarter-bar')).toHaveCount(0);
    await expect(page.getByTestId('audits-count')).toHaveText('0');
    expect(await page.locator('main').innerText()).not.toMatch(/NaN|undefined|Infinity/);
    await noPageScroll(page);
    const q = new URL(url, 'http://x').search;
    await expect(page.getByTestId('breadcrumb').getByRole('link', { name: 'Overview' })).toHaveAttribute('href', `/${q}`);
  }
  await page.goto(`/audits?${Q}&band=excellent`);
  await expect(page.getByTestId('empty-state')).toContainText('No contractors in this band');
  await expect(page.getByTestId('audits-row')).toHaveCount(0);
  await expect(page.getByTestId('audits-bands')).toBeVisible();
  await noPageScroll(page);
});

test('units and names: timeline scores in %, region changes in pts, the Portfolio card reads "Open portfolio"', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await expect(page.getByTestId('kpi-score').getByRole('link').first()).toHaveAttribute('aria-label', /\. Open portfolio$/);
  await page.goto('/audits?q=all&r=SR1%2CSR2');
  for (const t of (await page.getByTestId('audit-dot').allInnerTexts()).slice(0, 6)) expect(t.trim()).toMatch(/^\d+%$/);
  for (const t of await page.getByTestId('region-filter').allInnerTexts()) if (/[+−±]\d/.test(t)) expect(t).toMatch(/[+−±]\d+ pts?/);
});
