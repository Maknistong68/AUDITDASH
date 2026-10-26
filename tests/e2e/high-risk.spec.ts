import { test, expect, type Page } from '@playwright/test';
import { getRepo } from '../../lib/data/repo';
import { filterAudits, highRiskByContractor, highRiskByHazard, highRiskCount } from '../../lib/analytics';
import { rankHighRisk } from '../../lib/highRisk';

const ALL = { quarter: 'all' as const, regions: ['SR1', 'SR2'] as ('SR1' | 'SR2')[] };
const Q = 'q=all&r=SR1%2CSR2';
const HAZARDS = highRiskByHazard(getRepo(), ALL);
const CONTRACTORS = highRiskByContractor(getRepo(), ALL);
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

test('the dashboard High-risk work card opens /high-risk with a ~1 s shared hand-off; the header shows 127', async ({ page }) => {
  expect(highRiskCount(getRepo(), ALL)).toBe(127);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  const card = page.getByTestId('kpi-highrisk');
  await expect(card.getByTestId('highrisk-count')).toHaveText('127');
  await watchTransitions(page);
  await card.getByRole('link').click();
  await expect(page).toHaveURL(new RegExp(`/high-risk\\?${Q}$`));
  await expect(page.getByTestId('highrisk-figure')).toHaveText('127');
  await expect(page.getByTestId('highrisk-header')).toContainText('high-risk findings');
  await expect(page.getByTestId('breadcrumb')).toHaveText(/Overview\s*High-risk work/);
  await expect.poll(async () => Object.keys((await transitions(page)).durations).length).toBeGreaterThan(0);
  const { handoffs, durations } = await transitions(page);
  expect(handoffs).toBe(1);
  // the card grows into the header strip and the figure flies into the header figure, each about 1 s
  expect(durations['::view-transition-group(hr-card)']).toBeGreaterThanOrEqual(900);
  expect(durations['::view-transition-group(hr-figure)']).toBeGreaterThanOrEqual(900);
  expect(durations['::view-transition-group(hr-card)']).toBeLessThanOrEqual(1100);
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter((a) => (a.effect as KeyframeEffect | null)?.pseudoElement).length)).toBe(0);
  expect(await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('*')].map((e) => getComputedStyle(e).viewTransitionName).filter((n) => n !== 'none' && n !== 'root').sort())).toEqual(['hr-card', 'hr-figure']);
});

test('header: Q4 vs Q1 findings per audit (as on the card) and each quarter\'s total', async ({ page }) => {
  const repo = getRepo();
  const q = (quarter: 'Q4-2025' | 'Q1-2026') => ({ count: highRiskCount(repo, { ...ALL, quarter }), audits: filterAudits(repo, { ...ALL, quarter }).length });
  const [q4, q1] = [q('Q4-2025'), q('Q1-2026')];
  await page.goto(`/high-risk?${Q}`);
  await expect(page.getByTestId('highrisk-quarter-rate')).toHaveText([(q4.count / q4.audits).toFixed(1), (q1.count / q1.audits).toFixed(1)]);
  await expect(page.getByTestId('highrisk-quarter-rate')).toHaveText(['4.7', '7.7']);
  await expect(page.getByTestId('highrisk-quarter-total')).toHaveText([String(q4.count), String(q1.count)]);
  expect(q4.count + q1.count).toBe(127);
});

test('by hazard: plain labels with count and %, buckets sum to 127', async ({ page }) => {
  expect(HAZARDS.reduce((s, h) => s + h.count, 0)).toBe(127);
  await page.goto(`/high-risk?${Q}`);
  const rows = page.getByTestId('hazard');
  const shown = HAZARDS.filter((h) => h.count > 0);
  await expect(rows).toHaveCount(shown.length);
  const counts = await rows.evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-count'))));
  expect(counts.reduce((s, n) => s + n, 0)).toBe(127);
  expect(counts).toEqual([...counts].sort((a, b) => b - a));
  for (const h of shown) {
    const row = page.locator(`[data-testid="hazard"][data-hazard="${h.hazard}"]`);
    await expect(row).toContainText(h.label);
    await expect(row).toContainText(`${Math.round(h.share * 100)}%`);
  }
  await expect(page.getByTestId('hazard-segment')).toHaveCount(shown.length);
  await expect(page.getByTestId('hazard-center')).toHaveText('127');
});

for (const [w, h] of [[1366, 768], [1920, 1080]] as const) {
  test(`/high-risk at ${w}×${h}: one screen, every contractor, no codes`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`/high-risk?${Q}`);
    await expect(page.getByTestId('highrisk-contractors')).toBeVisible();
    await noPageScroll(page);
    await expect(page.getByTestId('highrisk-contractor')).toHaveCount(CONTRACTORS.length);
    for (const row of await page.getByTestId('highrisk-contractor').all()) await expect(row).toBeInViewport({ ratio: 1 });
    for (const row of await page.getByTestId('hazard').all()) await expect(row).toBeInViewport({ ratio: 1 });
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(CODE);
    expect(text).not.toContain('?');
    expect(text).not.toMatch(/NaN|undefined|Infinity/);
  });
}

test('contractors ranked worst first by findings per audit; a hazard click filters, sets hz, and clears on a second click', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`/high-risk?${Q}`);
  const ids = () => page.getByTestId('highrisk-contractor').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')));
  expect(await ids()).toEqual(rankHighRisk(CONTRACTORS).map((r) => r.id));
  await expect(page.getByTestId('highrisk-contractor-rate')).toHaveText(rankHighRisk(CONTRACTORS).map((r) => r.now.toFixed(1)));
  // two quarters: a Q4 marker on every contractor audited in both
  await expect(page.getByTestId('highrisk-contractor-past')).toHaveCount(rankHighRisk(CONTRACTORS).filter((r) => r.past !== null).length);

  const electrical = page.locator('[data-testid="hazard"][data-hazard="electrical"]');
  await electrical.click();
  await expect(page).toHaveURL(new RegExp(`/high-risk\\?${Q}&hz=electrical$`));
  await expect(electrical).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('hazard-chip')).toContainText('Electrical');
  await expect(page.getByTestId('hazard-center')).toHaveText(String(HAZARDS.find((h) => h.hazard === 'electrical')!.count));
  const ranked = rankHighRisk(CONTRACTORS, 'electrical');
  await expect.poll(ids).toEqual(ranked.map((r) => r.id));
  await expect(page.getByTestId('highrisk-contractor-rate')).toHaveText(ranked.map((r) => r.now.toFixed(1)));
  // shareable: a fresh load with hz keeps the filter
  await page.reload();
  await expect(page.locator('[data-testid="hazard"][data-hazard="electrical"]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(ids).toEqual(ranked.map((r) => r.id));
  // a second click clears it
  await page.locator('[data-testid="hazard"][data-hazard="electrical"]').click();
  await expect(page).toHaveURL(new RegExp(`/high-risk\\?${Q}$`));
  await expect(page.getByTestId('hazard-chip')).toHaveCount(0);
  await expect.poll(ids).toEqual(rankHighRisk(CONTRACTORS).map((r) => r.id));
  // a donut segment works too
  // (clicked on its stroke, once the reload's draw-in has painted it)
  const segment = page.locator('[data-testid="hazard-segment"][data-hazard="permits"]');
  const mid = () => segment.evaluate((el) => {
    const path = el as SVGPathElement;
    const p = path.getPointAtLength(path.getTotalLength() / 2).matrixTransform(path.getScreenCTM()!);
    return { x: p.x, y: p.y, hit: document.elementFromPoint(p.x, p.y) === el };
  });
  await expect.poll(async () => (await mid()).hit).toBe(true);
  const { x, y } = await mid();
  await page.mouse.click(x, y);
  await expect(page).toHaveURL(/hz=permits$/);
});

test('a contractor bar drills to the contractor page with the filter', async ({ page }) => {
  await page.goto(`/high-risk?${Q}&hz=excavation`);
  const first = page.getByTestId('highrisk-contractor').first();
  const id = await first.getAttribute('data-id');
  expect(id).toBe(rankHighRisk(CONTRACTORS, 'excavation')[0].id);
  await first.click();
  await expect(page).toHaveURL(new RegExp(`/contractor/${id}\\?${Q}$`));
});

test('/high-risk: Esc returns to the overview with the filter', async ({ page }) => {
  await page.goto('/high-risk?q=Q1-2026&r=SR1');
  await expect(page.locator('body[data-esc-ready]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/\?q=Q1-2026&r=SR1$/);
});

test('reduced motion: the high-risk card still navigates, with no transition', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await page.goto('/');
  await watchTransitions(page);
  await page.getByTestId('kpi-highrisk').getByRole('link').click();
  await expect(page).toHaveURL(new RegExp(`/high-risk\\?${Q}$`));
  await expect(page.getByTestId('highrisk-figure')).toHaveText('127');
  expect((await transitions(page)).handoffs).toBe(0);
  await ctx.close();
});

test('Q4 only: one quarter in the header, no past markers', async ({ page }) => {
  const f = { ...ALL, quarter: 'Q4-2025' as const };
  await page.goto('/high-risk?q=Q4-2025&r=SR1%2CSR2');
  await expect(page.getByTestId('highrisk-figure')).toHaveText(String(highRiskCount(getRepo(), f)));
  await expect(page.getByTestId('highrisk-quarter-bar')).toHaveCount(1);
  await expect(page.getByTestId('highrisk-quarter-total')).toHaveText([String(highRiskCount(getRepo(), f))]);
  await expect(page.getByTestId('highrisk-contractor')).toHaveCount(highRiskByContractor(getRepo(), f).length);
  await expect(page.getByTestId('highrisk-contractor-past')).toHaveCount(0);
  const counts = await page.getByTestId('hazard').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-count'))));
  expect(counts.reduce((s, n) => s + n, 0)).toBe(highRiskCount(getRepo(), f));
  expect(await page.locator('main').innerText()).not.toMatch(/NaN|undefined|Infinity/);
});

test('/high-risk under a non-H&S type or an empty filter: calm empty state, same header, no NaN', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  for (const [url, title] of [
    ['/high-risk?q=all&r=SR1%2CSR2&t=security', 'No audits match this filter'],
    ['/high-risk?q=all&r=', 'No audits match this filter'],
  ] as const) {
    await page.goto(url);
    await expect(page.getByTestId('highrisk-figure')).toHaveText('0');
    await expect(page.getByTestId('empty-state')).toContainText(title);
    await expect(page.getByTestId('highrisk-contractors')).toHaveCount(0);
    await expect(page.getByTestId('highrisk-quarter-bar')).toHaveCount(0);
    expect(await page.locator('main').innerText()).not.toMatch(/NaN|undefined|Infinity/);
    await noPageScroll(page);
    const q = new URL(url, 'http://x').search;
    await expect(page.getByTestId('breadcrumb').getByRole('link', { name: 'Overview' })).toHaveAttribute('href', `/${q}`);
  }
});
