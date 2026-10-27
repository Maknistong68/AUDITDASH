import { test, expect, type Page } from '@playwright/test';
import { getRepo } from '../../lib/data/repo';
import { followUps, repeatContractors, repeatFindings, repeatQuestions } from '../../lib/analytics';
import type { Filter } from '../../lib/types';

const ALL: Filter = { quarter: 'all', regions: ['SR1', 'SR2'] };
const Q = 'q=all&r=SR1%2CSR2';
const ROWS = repeatQuestions(getRepo(), ALL);
const COLS = repeatContractors(getRepo(), ALL);
const TOTAL = String(repeatFindings(getRepo(), ALL).length);
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

test('the dashboard Repeat findings card opens /repeats with a ~1 s shared hand-off; the header shows the same count', async ({ page }) => {
  expect(TOTAL).toBe('345');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  const card = page.getByTestId('kpi-repeats');
  await expect(card.getByTestId('repeats-count')).toHaveText(TOTAL);
  await watchTransitions(page);
  await card.getByRole('link').click();
  await expect(page).toHaveURL(new RegExp(`/repeats\\?${Q}$`));
  await expect(page.getByTestId('repeats-figure')).toHaveText(TOTAL);
  await expect(page.getByTestId('repeats-header')).toContainText("same question noted again at the contractor's next audit");
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
  test(`/repeats at ${w}×${h}: one screen, every repeated question × ${COLS.length} contractors, no codes`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`/repeats?${Q}`);
    await expect(page.getByTestId('repeats-matrix')).toBeVisible();
    await noPageScroll(page);
    await expect(page.getByTestId('repeats-col')).toHaveCount(7);
    expect(COLS).toHaveLength(7);
    const rows = await allRows(page);
    await expect(rows).toHaveCount(ROWS.length);
    await noPageScroll(page);
    // rows in order, plain labels, widest reach first; one filled dot per contractor that repeated it
    const labels = await page.getByTestId('repeats-label').allInnerTexts();
    expect(labels).toEqual(ROWS.map((r) => r.label));
    const reach = await rows.evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-reach'))));
    expect(reach).toEqual([...reach].sort((a, b) => b - a));
    for (let i = 0; i < ROWS.length; i++) await expect(rows.nth(i).locator('[data-testid="repeats-cell"][data-filled]')).toHaveCount(ROWS[i].contractorCount);
    await expect(rows.first().getByTestId('repeats-cell')).toHaveCount(7);
    // no checklist codes anywhere on the page, no question sentences
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(CODE);
    expect(text).not.toContain('?');
    expect(text).not.toMatch(/NaN|undefined/);
  });
}

test('/repeats: every row shows how many times it was repeated; dot, label and column drill down', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`/repeats?${Q}`);
  const row = page.getByTestId('repeats-row').first();
  await expect(page.getByTestId('repeats-matrix')).toContainText('times repeated');
  const rows = await allRows(page);
  for (let i = 0; i < (await rows.count()); i++) await expect(rows.nth(i).getByTestId('repeats-times')).toHaveText(`${ROWS[i].times}×`);
  await expect(row.getByTestId('repeats-times')).toHaveAttribute('aria-label', `Repeated ${ROWS[0].times} times at ${ROWS[0].contractorCount} contractors`);
  await page.goto(`/repeats?${Q}`);

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
  await expect(page.getByTestId('repeats-figure')).toHaveText(TOTAL);
  expect((await transitions(page)).handoffs).toBe(0);
  await ctx.close();
});

test('/repeats without a follow-up audit: calm empty state, same header, no NaN', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  for (const [url, figure, title] of [
    ['/repeats?q=all&r=SR1%2CSR2&t=security', '—', 'Needs a follow-up audit'],
    ['/repeats?q=all&r=', '—', 'Needs a follow-up audit'],
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
  expect(shown).toBeLessThan(ROWS.length);
  await expect(more).toHaveText(`+${ROWS.length - shown} more`);
  await noPageScroll(page);
  await more.click();
  await expect(page.getByTestId('repeats-row')).toHaveCount(ROWS.length);
  await expect(page.getByTestId('repeats-label').nth(shown)).toBeFocused();
  await page.getByTestId('repeats-row').last().scrollIntoViewIfNeeded();
  await expect(page.getByTestId('repeats-row').last()).toBeInViewport();
  await noPageScroll(page);
});

test('/repeats header: the rule, and what the count is made of', async ({ page }) => {
  await page.goto(`/repeats?${Q}`);
  const header = page.getByTestId('repeats-header');
  await expect(header.getByTestId('repeats-rule')).toHaveText("same question noted again at the contractor's next audit");
  await expect(header.getByTestId('repeats-questions')).toHaveText(`${ROWS.length} questions`);
  await expect(header.getByTestId('repeats-contractors')).toHaveText(`${COLS.length} contractors`);
  await expect(header.getByTestId('repeats-followups')).toHaveText(`${followUps(getRepo(), ALL).length} follow-up audits`);
  await expect(header.getByTestId('repeats-spread')).toBeVisible();
});

test('/repeats Q4 only: the same-quarter follow-up (SIBS) shows its repeats', async ({ page }) => {
  const f: Filter = { ...ALL, quarter: 'Q4-2025' };
  await page.goto('/repeats?q=Q4-2025&r=SR1%2CSR2');
  await expect(page.getByTestId('repeats-figure')).toHaveText(String(repeatFindings(getRepo(), f).length));
  await expect(page.getByTestId('repeats-col')).toHaveCount(1);
  await expect(page.getByTestId('repeats-matrix')).toBeVisible();
});

test('/repeats single region: repeats within that region only', async ({ page }) => {
  for (const r of ['SR1', 'SR2'] as const) {
    await page.goto(`/repeats?q=all&r=${r}`);
    await expect(page.getByTestId('repeats-figure')).toHaveText(String(repeatFindings(getRepo(), { quarter: 'all', regions: [r] }).length));
    await expect(page.getByTestId('repeats-col')).toHaveCount(repeatContractors(getRepo(), { quarter: 'all', regions: [r] }).length);
  }
});

test('/repeats matrix: two encodings (tint and size by step), per-cell labels, plain legends, row indices', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`/repeats?${Q}`);
  const matrix = page.getByTestId('repeats-matrix');
  await expect(page.getByTestId('repeats-legend')).toHaveText(/^score lost: low\s*high$/);
  const cells = matrix.locator('[data-testid="repeats-cell"][data-filled]');
  const info = await cells.evaluateAll((els) => els.map((e) => {
    const dot = e.querySelector('[data-testid="repeats-dot"], [data-testid="repeats-dot-unscored"]') as HTMLElement;
    return { step: e.getAttribute('data-step'), label: e.getAttribute('aria-label'), w: dot.getBoundingClientRect().width, unscored: dot.dataset.testid === 'repeats-dot-unscored' };
  }));
  expect(info.length).toBeGreaterThan(0);
  const width = new Map<string, number>();
  for (const c of info) {
    expect(c.label).toMatch(/^.+: repeated, (\d+% score lost|score not available)$/);
    expect(c.unscored).toBe(c.step === 'none');
    if (c.step !== 'none') width.set(c.step!, Math.round(c.w * 10) / 10);
  }
  // larger dot = more score lost
  const steps = [...width.keys()].sort();
  for (let i = 1; i < steps.length; i++) expect(width.get(steps[i])!).toBeGreaterThan(width.get(steps[i - 1])!);
  await expect(matrix.locator('[data-testid="repeats-cell"]:not([data-filled])').first()).toHaveAttribute('aria-label', /^.+: not repeated$/);
  // aria-rowcount is backed by aria-rowindex on every row (all rows shown)
  await allRows(page);
  await expect(matrix).toHaveAttribute('aria-rowcount', String(ROWS.length + 1));
  const idx = await matrix.locator('[role="row"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-rowindex')));
  expect(idx.slice(0, ROWS.length + 1)).toEqual(Array.from({ length: ROWS.length + 1 }, (_, i) => String(i + 1)));
});

for (const scheme of ['light', 'dark'] as const) {
  test(`/repeats ${scheme} theme: every dot tint is at least 3:1 against the card`, async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: 1920, height: 1080 } });
    await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch { /* private mode */ } }, scheme);
    const page = await ctx.newPage();
    await page.goto(`/repeats?${Q}`);
    await expect(page.getByTestId('repeats-matrix')).toBeVisible();
    const ratios = await page.evaluate(() => {
      const cv = document.createElement('canvas').getContext('2d')!;
      const rgb = (c: string) => { cv.fillStyle = '#000'; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); return [...cv.getImageData(0, 0, 1, 1).data].slice(0, 3); };
      const lum = (c: number[]) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const card = lum(rgb(getComputedStyle(document.querySelector('[data-testid="repeats-matrix"]')!).backgroundColor));
      const root = getComputedStyle(document.documentElement);
      return [0, 1, 2, 3].map((k) => { const l = lum(rgb(root.getPropertyValue(`--rp-${k}`).trim())); return (Math.max(l, card) + 0.05) / (Math.min(l, card) + 0.05); });
    });
    for (const r of ratios) expect(r).toBeGreaterThanOrEqual(3);
    await ctx.close();
  });
}
