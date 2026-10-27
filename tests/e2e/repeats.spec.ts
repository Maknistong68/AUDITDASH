import { test, expect, type Page } from '@playwright/test';
import { getRepo } from '../../lib/data/repo';
import { repeatFindings, repeatMatrix } from '../../lib/analytics';
import { CATEGORIES } from '../../lib/categories';
import type { Filter } from '../../lib/types';
import { expectNothingClipped } from './clip';

const ALL: Filter = { quarter: 'all', regions: ['SR1', 'SR2'] };
const Q = 'q=all&r=SR1%2CSR2';
const M = repeatMatrix(getRepo(), ALL);
const COLS = M.contractors;
/** Rows as the page shows them: grouped by category (groups in order of their first row), rows keep the matrix order. */
const GROUPS = [...new Set(M.questions.map((q) => q.category))].map((cat) => ({ cat, rows: M.questions.filter((q) => q.category === cat) }));
const ROWS = GROUPS.flatMap((g) => g.rows);
const TOTAL = String(M.questions.reduce((s, q) => s + q.total, 0));
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

test('the dashboard Repeat findings card opens /repeats with a ~1 s shared hand-off; the header shows the same count', async ({ page }) => {
  expect(TOTAL).toBe('228');
  expect(TOTAL).toBe(String(repeatFindings(getRepo(), ALL).length));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  const card = page.getByTestId('kpi-repeats');
  await expect(card.getByTestId('repeats-count')).toHaveText(TOTAL);
  await watchTransitions(page);
  await card.getByRole('link').click();
  await expect(page).toHaveURL(new RegExp(`/repeats\\?${Q}$`));
  await expect(page.getByTestId('repeats-figure')).toHaveText(TOTAL);
  await expect(page.getByTestId('repeats-header')).toContainText('questions noted again in the next audit');
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

for (const [w, h] of [[1366, 657], [1366, 768], [1920, 1080]] as const) {
  test(`/repeats at ${w}×${h}: one screen, heat map of ${ROWS.length} questions × ${COLS.length} contractors, nothing clipped, no codes`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`/repeats?${Q}`);
    await expect(page.getByTestId('repeats-heatmap')).toBeVisible();
    await noPageScroll(page);
    await expectNothingClipped(page, `/repeats at ${w}×${h}`);
    await expect(page.getByTestId('heat-col')).toHaveCount(COLS.length);
    await expect(page.getByTestId('heat-row')).toHaveCount(ROWS.length);
    await expect(page.getByTestId('heat-cell')).toHaveCount(ROWS.length * COLS.length);
    // thin category header rows, in order; plain labels in order
    await expect(page.getByTestId('heat-group')).toHaveText(GROUPS.map((g) => CATEGORIES.find((c) => c.id === g.cat)!.name));
    expect(await page.getByTestId('heat-label').allInnerTexts()).toEqual(ROWS.map((r) => r.label));
    // no checklist codes anywhere on the page, no question sentences, no NaN
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(CODE);
    expect(text).not.toContain('?');
    expect(text).not.toMatch(/NaN|undefined/);
  });
}

test('/repeats heat map: every cell is the times repeated (blank at 0); row and column totals match repeatMatrix', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`/repeats?${Q}`);
  const cells = await page.getByTestId('heat-cell').evaluateAll((els) => els.map((e) => ({ n: Number(e.getAttribute('data-n')), text: (e as HTMLElement).innerText.trim() })));
  const want = ROWS.flatMap((r) => COLS.map((c) => M.cells[c.id]?.[r.itemCode] ?? 0));
  expect(cells.map((c) => c.n)).toEqual(want);
  for (const c of cells) expect(c.text).toBe(c.n ? String(c.n) : '');
  expect(cells.filter((c) => c.n > 0).length).toBeGreaterThan(0);
  expect(await page.getByTestId('heat-row-total').allInnerTexts()).toEqual(ROWS.map((r) => String(r.total)));
  expect(await page.getByTestId('heat-col-total').allInnerTexts()).toEqual(COLS.map((c) => String(c.total)));
  await expect(page.getByTestId('heat-total')).toHaveText(TOTAL);
  // column heads: short name, qualifier on a second line, most repeats first
  const heads = await page.getByTestId('heat-col').evaluateAll((els) => els.map((e) => e.getAttribute('title')));
  expect(heads).toEqual(COLS.map((c) => c.name));
  await expect(page.getByTestId('heat-col').filter({ hasText: 'Box Culvert H55' }).locator('span')).toHaveText(['Abyatona', 'Box Culvert H55']);
});

test('/repeats heat map: hover and focus show the cell, a cell drills to the item, a column head to the contractor', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`/repeats?${Q}`);
  const r = ROWS[0];
  const k = COLS.findIndex((c) => (M.cells[c.id]?.[r.itemCode] ?? 0) > 0);
  const c = COLS[k];
  const n = M.cells[c.id][r.itemCode];
  const cell = page.getByTestId('heat-row').first().getByTestId('heat-cell').nth(k);
  await cell.hover();
  await expect(page.getByTestId('heat-tooltip')).toHaveText(`${c.name} · ${r.label}: repeated ${n}×`);
  await page.mouse.move(5, 5);
  await expect(page.getByTestId('heat-tooltip')).toHaveCount(0);
  await cell.getByRole('link').focus();
  await expect(page.getByTestId('heat-tooltip')).toHaveText(`${c.name} · ${r.label}: repeated ${n}×`);
  await expect(cell.getByRole('link')).toHaveAttribute('aria-label', `${c.name} · ${r.label}: repeated ${n}×`);
  await cell.getByRole('link').click();
  await expect(page).toHaveURL(new RegExp(`/category/${r.category}/${c.id}/${r.itemCode.replace('.', '\\.')}\\?${Q}$`));
  await page.goBack();
  await page.getByTestId('heat-col').first().click();
  await expect(page).toHaveURL(new RegExp(`/contractor/${COLS[0].id}\\?${Q}$`));
});

test('/repeats heat map on a short screen: the grid scrolls in its card, header row and label column stay', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  await page.goto(`/repeats?${Q}`);
  const scroller = page.getByTestId('heat-scroll');
  const [sh, ch] = await scroller.evaluate((e) => [e.scrollHeight, e.clientHeight]);
  expect(sh).toBeGreaterThan(ch);
  const headTop = await page.getByTestId('heat-col').first().evaluate((e) => e.getBoundingClientRect().top);
  await scroller.evaluate((e) => { e.scrollTop = e.scrollHeight; });
  await expect.poll(() => page.getByTestId('heat-col').first().evaluate((e) => e.getBoundingClientRect().top)).toBe(headTop);
  await expect(page.getByTestId('heat-row').last()).toBeInViewport();
  await expect(page.getByTestId('heat-total')).toBeInViewport();
  await noPageScroll(page);
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
    await expect(page.getByTestId('repeats-heatmap')).toHaveCount(0);
    expect(await page.locator('main').innerText()).not.toMatch(/NaN|undefined/);
    await noPageScroll(page);
    // the breadcrumb keeps the filter
    const q = new URL(url, 'http://x').search;
    await expect(page.getByTestId('breadcrumb').getByRole('link', { name: 'Overview' })).toHaveAttribute('href', `/${q}`);
  }
});

test('/repeats header: "N repeats", questions · contractors, the basis; no reach bar or threshold', async ({ page }) => {
  await page.goto(`/repeats?${Q}`);
  const header = page.getByTestId('repeats-header');
  await expect(header.getByTestId('repeats-total')).toHaveText(`${TOTAL} repeats`);
  await expect(header.getByTestId('repeats-rule')).toHaveText('questions noted again in the next audit');
  await expect(header.getByTestId('repeats-questions')).toHaveText(`${ROWS.length} questions`);
  await expect(header.getByTestId('repeats-contractors')).toHaveText(`${COLS.length} contractors`);
  await expect(header.getByTestId('repeats-basis')).toHaveText('based on auditor notes');
  await expect(page.getByTestId('repeats-spread')).toHaveCount(0);
  await expect(page.getByTestId('repeats-followups')).toHaveCount(0);
  expect(await page.locator('main').innerText()).not.toMatch(/\bof 7\b|≥\s*5/);
});

test('/repeats Q4 only: no follow-up visit (SIBS\'s two Q4 audits are one visit), calm empty state, no NaN', async ({ page }) => {
  const f: Filter = { ...ALL, quarter: 'Q4-2025' };
  expect(repeatFindings(getRepo(), f)).toEqual([]);
  await page.goto('/repeats?q=Q4-2025&r=SR1%2CSR2');
  await expect(page.getByTestId('repeats-figure')).toHaveText('—');
  await expect(page.getByTestId('empty-state')).toContainText('Needs a follow-up audit');
  await expect(page.getByTestId('repeats-heatmap')).toHaveCount(0);
  expect(await page.locator('main').innerText()).not.toMatch(/NaN|undefined/);
});

test('/repeats single region: repeats within that region only', async ({ page }) => {
  for (const r of ['SR1', 'SR2'] as const) {
    const m = repeatMatrix(getRepo(), { quarter: 'all', regions: [r] });
    await page.goto(`/repeats?q=all&r=${r}`);
    await expect(page.getByTestId('repeats-figure')).toHaveText(String(repeatFindings(getRepo(), { quarter: 'all', regions: [r] }).length));
    await expect(page.getByTestId('heat-col')).toHaveCount(m.contractors.length);
    await expect(page.getByTestId('heat-cell')).toHaveCount(m.contractors.length * m.questions.length);
  }
});

for (const scheme of ['light', 'dark'] as const) {
  test(`/repeats ${scheme} theme: every non-zero cell fill is at least 3:1 on the card, its number at least 4.5:1 on the fill`, async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce' });
    await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch { /* private mode */ } }, scheme);
    const page = await ctx.newPage();
    await page.goto(`/repeats?${Q}`);
    await expect(page.getByTestId('repeats-heatmap')).toBeVisible();
    const out = await page.evaluate(() => {
      const cv = document.createElement('canvas').getContext('2d')!;
      const rgb = (c: string) => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = '#000'; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); return [...cv.getImageData(0, 0, 1, 1).data].slice(0, 3); };
      const lum = (c: number[]) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const ratio = (a: string, b: string) => { const [x, y] = [lum(rgb(a)), lum(rgb(b))]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const card = getComputedStyle(document.querySelector('[data-testid="repeats-heatmap"]')!).backgroundColor;
      const fills = [...document.querySelectorAll<HTMLElement>('[data-testid="heat-cell"]:not([data-n="0"]) a')];
      // every step of the ramp (also those no cell uses yet), through the key's swatches
      const keys = [...document.querySelectorAll<HTMLElement>('[data-testid="repeats-legend"] span span')];
      return { n: fills.length, card, ratios: [...fills, ...keys].map((e) => { const s = getComputedStyle(e); return { fill: ratio(s.backgroundColor, card), ink: ratio(s.color, s.backgroundColor) }; }) };
    });
    expect(out.n).toBeGreaterThan(0);
    for (const r of out.ratios) {
      expect(r.fill).toBeGreaterThanOrEqual(3);
      expect(r.ink).toBeGreaterThanOrEqual(4.5);
    }
    if (scheme === 'dark') expect(out.card).not.toBe('rgb(255, 255, 255)');
    await ctx.close();
  });
}
