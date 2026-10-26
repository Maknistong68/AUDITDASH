import { test, expect, type Page } from '@playwright/test';
import { getRepo } from '../../lib/data/repo';
import { repeatContractors, systemicRepeats } from '../../lib/analytics';

const ALL = { quarter: 'all' as const, regions: ['SR1', 'SR2'] as ('SR1' | 'SR2')[] };
const Q = 'q=all&r=SR1%2CSR2';
const ROWS = systemicRepeats(getRepo(), ALL);
const COLS = repeatContractors(getRepo(), ALL);
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

/** Every matrix row, expanding "+M more" when the screen cannot show them all. */
async function allRows(page: Page) {
  const more = page.getByTestId('repeats-more');
  if (await more.count()) await more.click();
  return page.getByTestId('repeats-row');
}

async function noPageScroll(page: Page) {
  const [sh, ih, sw, iw] = await page.evaluate(() => [
    document.documentElement.scrollHeight, innerHeight, document.documentElement.scrollWidth, innerWidth,
  ]);
  expect(sh).toBeLessThanOrEqual(ih);
  expect(sw).toBeLessThanOrEqual(iw);
}

test('the dashboard Repeat findings card opens /repeats with a ~1 s shared hand-off; the header shows 28', async ({ page }) => {
  expect(ROWS).toHaveLength(28);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  const card = page.getByTestId('kpi-repeats');
  await expect(card.getByTestId('repeats-count')).toHaveText('28');
  await watchTransitions(page);
  await card.getByRole('link').click();
  await expect(page).toHaveURL(new RegExp(`/repeats\\?${Q}$`));
  await expect(page.getByTestId('repeats-figure')).toHaveText('28');
  await expect(page.getByTestId('repeats-header')).toContainText('questions repeating');
  await expect(page.getByTestId('breadcrumb')).toHaveText(/Overview\s*Repeat findings/);
  await expect.poll(async () => Object.keys((await transitions(page)).durations).length).toBeGreaterThan(0);
  const { handoffs, durations } = await transitions(page);
  expect(handoffs).toBe(1);
  // the card grows into the header strip and the figure flies into the header figure, each about 1 s
  expect(durations['::view-transition-group(rp-card)']).toBeGreaterThanOrEqual(900);
  expect(durations['::view-transition-group(rp-figure)']).toBeGreaterThanOrEqual(900);
  expect(durations['::view-transition-group(rp-card)']).toBeLessThanOrEqual(1100);
  // the hand-off landed: nothing left running, the names are only on the landing elements
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter((a) => (a.effect as KeyframeEffect | null)?.pseudoElement).length)).toBe(0);
  expect(await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('*')].map((e) => getComputedStyle(e).viewTransitionName).filter((n) => n !== 'none' && n !== 'root').sort())).toEqual(['rp-card', 'rp-figure']);
});

test('the Main problem hand-off also runs about 1 s', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await watchTransitions(page);
  await page.getByTestId('main-problem').getByRole('link').click();
  await expect(page).toHaveURL(/\/category\//);
  await expect.poll(async () => (await transitions(page)).durations['::view-transition-group(mp-card)'] ?? 0).toBeGreaterThanOrEqual(900);
  // the category carousel cards use the dashboard's wording
  await expect(page.locator('[data-testid="category-card"][data-active]')).toContainText('score lost');
  await expect(page.locator('[data-testid="category-card"][data-active]').getByText('score lost')).toBeVisible();
});

for (const [w, h] of [[1366, 768], [1920, 1080]] as const) {
  test(`/repeats at ${w}×${h}: one screen, 28 issue rows × ${COLS.length} contractors, no codes`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`/repeats?${Q}`);
    await expect(page.getByTestId('repeats-matrix')).toBeVisible();
    await noPageScroll(page);
    await expect(page.getByTestId('repeats-col')).toHaveCount(7);
    expect(COLS).toHaveLength(7);
    const rows = await allRows(page);
    await expect(rows).toHaveCount(28);
    await noPageScroll(page);
    // rows in order, plain labels, worst reach first; one filled dot per contractor hit
    const labels = await page.getByTestId('repeats-label').allInnerTexts();
    expect(labels).toEqual(ROWS.map((r) => r.label));
    const reach = await rows.evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-reach'))));
    expect(reach).toEqual([...reach].sort((a, b) => b - a));
    for (let i = 0; i < 28; i++) await expect(rows.nth(i).locator('[data-testid="repeats-cell"][data-filled]')).toHaveCount(ROWS[i].contractorCount);
    await expect(rows.first().getByTestId('repeats-cell')).toHaveCount(7);
    // no checklist codes anywhere on the page, no question sentences
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(CODE);
    expect(text).not.toContain('?');
    expect(text).not.toMatch(/NaN|undefined/);
  });
}

test('/repeats: a row shows its Q4 → Q1 notes on hover; dot, label and column drill down', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`/repeats?${Q}`);
  const row = page.getByTestId('repeats-row').first();
  const trend = row.getByTestId('repeats-trend');
  await expect(trend).toHaveCSS('opacity', '0');
  await row.hover();
  await expect(trend).toHaveCSS('opacity', '1');
  await expect(trend).toHaveText(`${ROWS[0].q4Notes}→${ROWS[0].q1Notes}`);
  // focus shows it too
  await page.mouse.move(0, 0);
  await page.getByTestId('repeats-row').nth(1).getByTestId('repeats-label').focus();
  await expect(page.getByTestId('repeats-row').nth(1).getByTestId('repeats-trend')).toHaveCSS('opacity', '1');

  const r = ROWS[0];
  await row.locator('[data-testid="repeats-cell"][data-filled]').first().click();
  await expect(page).toHaveURL(new RegExp(`/category/${r.category}/\\d+/${r.itemCode.replace('.', '\\.')}\\?${Q}$`));
  await page.goBack();
  await page.getByTestId('repeats-label').first().click();
  await expect(page).toHaveURL(new RegExp(`/category/${r.category}\\?${Q}#item-${r.itemCode.replace('.', '\\.')}$`));
  await page.goBack();
  await page.getByTestId('repeats-col').first().click();
  await expect(page).toHaveURL(new RegExp(`/contractor/\\d+\\?${Q}$`));
});

test('/repeats: Esc returns to the overview with the filter', async ({ page }) => {
  await page.goto('/repeats?q=Q1-2026&r=SR1');
  await expect(page.locator('body[data-esc-ready]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/\?q=Q1-2026&r=SR1$/);
});

test('reduced motion: the repeats card still navigates, with no transition', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await page.goto('/');
  await watchTransitions(page);
  await page.getByTestId('kpi-repeats').getByRole('link').click();
  await expect(page).toHaveURL(new RegExp(`/repeats\\?${Q}$`));
  await expect(page.getByTestId('repeats-figure')).toHaveText('28');
  expect((await transitions(page)).handoffs).toBe(0);
  await ctx.close();
});

test('/repeats under a single-quarter or empty filter: calm empty state, same header, no NaN', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  for (const [url, figure, title] of [
    ['/repeats?q=Q4-2025&r=SR1%2CSR2', '—', 'Needs an earlier quarter'],
    ['/repeats?q=all&r=SR1%2CSR2&t=security', '0', 'No questions repeating'],
  ] as const) {
    await page.goto(url);
    await expect(page.getByTestId('repeats-figure')).toHaveText(figure);
    await expect(page.getByTestId('empty-state')).toContainText(title);
    await expect(page.getByTestId('repeats-matrix')).toHaveCount(0);
    expect(await page.locator('main').innerText()).not.toMatch(/NaN|undefined/);
    await noPageScroll(page);
    // the breadcrumb keeps the filter
    const q = new URL(url, 'http://x').search;
    await expect(page.getByTestId('breadcrumb').getByRole('link', { name: 'Overview' })).toHaveAttribute('href', `/${q}`);
  }
});

test('/repeats on a short screen: top rows + "+M more" that expands in place; the page never scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 600 });
  await page.goto(`/repeats?${Q}`);
  const more = page.getByTestId('repeats-more');
  await expect(more).toBeVisible();
  const shown = await page.getByTestId('repeats-row').count();
  expect(shown).toBeLessThan(28);
  await expect(more).toHaveText(`+${28 - shown} more`);
  await noPageScroll(page);
  await more.click();
  await expect(page.getByTestId('repeats-row')).toHaveCount(28);
  await expect(page.getByTestId('repeats-label').nth(shown)).toBeFocused();
  await page.getByTestId('repeats-row').last().scrollIntoViewIfNeeded();
  await expect(page.getByTestId('repeats-row').last()).toBeInViewport();
  await noPageScroll(page);
});
