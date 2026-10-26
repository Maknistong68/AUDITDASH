import { test, expect, type Page } from '@playwright/test';
import { getRepo } from '../../lib/data/repo';
import { gapContribution, mainProblem } from '../../lib/analytics';
import { pct } from '../../lib/format';

const ALL = { quarter: 'all' as const, regions: ['SR1', 'SR2'] as ('SR1' | 'SR2')[] };
const expectedMain = mainProblem(getRepo(), ALL)!.category;
const expectedDrivers = gapContribution(getRepo(), ALL).slice(0, 4);
const hydrated = (page: Page) => expect(page.getByTestId('contractors')).toHaveAttribute('data-hydrated', '');
/** The card body outside the Driven By rows: the header's top-left corner. */
const BODY = { position: { x: 24, y: 24 } };

/** Counts document.startViewTransition calls (the hand-off) on every page of the context. */
const countTransitions = (page: Page) =>
  page.addInitScript(() => {
    const d = document as Document & { startViewTransition?: (cb: () => unknown) => unknown };
    const w = window as unknown as { __vt: number };
    w.__vt = 0;
    const orig = d.startViewTransition?.bind(d);
    if (orig) d.startViewTransition = (cb) => { w.__vt++; return orig(cb); };
  });

test('title, four ranked driver rows with % of lost score', async ({ page }) => {
  await page.goto('/');
  const mp = page.getByTestId('main-problem');
  await expect(mp.getByTestId('main-problem-title')).toHaveText(/Main Problem – (Q4 2025|Q1 2026)/);
  await expect(mp.getByTestId('main-problem-title')).toHaveText('Main Problem – Q1 2026');
  const rows = mp.getByTestId('driver-row');
  await expect(rows).toHaveCount(4);
  const shown = await rows.getByTestId('driver-share').allTextContents();
  for (const t of shown) expect(t).toMatch(/^\d+%$/);
  const nums = shown.map((t) => Number(t.replace('%', '')));
  expect(nums).toEqual([...nums].sort((a, b) => b - a));
  const exact = await rows.evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-share'))));
  expect(exact).toEqual([...exact].sort((a, b) => b - a));
  expect(await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-category')))).toEqual(expectedDrivers.map((d) => d.category));
  expect(nums).toEqual(expectedDrivers.map((d) => Number(pct(d.share))));
  // each row has an icon, a severity bar and its gap %
  for (let i = 0; i < 4; i++) {
    await expect(rows.nth(i).locator('svg')).toHaveCount(1);
    await expect(rows.nth(i)).toContainText(`${pct(expectedDrivers[i].gapRate)}%`);
  }
});

test('clicking the card body hands off to the main problem category (view transition)', async ({ page }) => {
  await countTransitions(page);
  await page.goto('/');
  await hydrated(page);
  await page.getByTestId('main-problem-open').click(BODY);
  await expect(page).toHaveURL(new RegExp(`/category/${expectedMain}\\?q=all&r=SR1%2CSR2$`));
  await expect(page.getByTestId('category-title')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __vt: number }).__vt)).toBe(1);
  // names are cleaned up once the transition is over
  await expect(page.locator('html')).not.toHaveAttribute('data-handoff', /.*/);
});

test('a driver row opens its own category', async ({ page }) => {
  await page.goto('/');
  await hydrated(page);
  const row = page.getByTestId('driver-row').nth(1);
  const cat = (await row.getAttribute('data-category'))!;
  await expect(row).toHaveAttribute('href', `/category/${cat}?q=all&r=SR1%2CSR2`);
  await row.click();
  await expect(page).toHaveURL(new RegExp(`/category/${cat}\\?q=all&r=SR1%2CSR2$`));
});

test('keyboard: Enter on the card opens it; the rows are focusable links', async ({ page }) => {
  await page.goto('/');
  await hydrated(page);
  const open = page.getByTestId('main-problem-open');
  await open.focus();
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('driver-row').first()).toBeFocused();
  await open.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/category/${expectedMain}\\?`));
});

test('reduced motion: instant navigation, no view transition', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await countTransitions(page);
  await page.goto('/');
  await hydrated(page);
  await page.getByTestId('main-problem-open').click(BODY);
  await expect(page).toHaveURL(new RegExp(`/category/${expectedMain}\\?`));
  await expect(page.getByTestId('category-title')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __vt: number }).__vt)).toBe(0);
  await ctx.close();
});

/** Largest vertical stretch inside the card not covered by any visible content leaf (text, icon, bar). */
const largestVoid = (page: Page) =>
  page.getByTestId('main-problem').evaluate((card) => {
    const box = card.getBoundingClientRect();
    const spans = Array.from(card.querySelectorAll('*'))
      .filter((el) => !el.closest('svg') || el.tagName === 'svg')
      .filter((el) => el.tagName === 'svg' || el.children.length === 0)
      .filter((el) => el.getAttribute('data-testid') !== 'main-problem-open')
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => [r.top, r.bottom] as const)
      .sort((a, b) => a[0] - b[0]);
    let gap = 0;
    let reach = box.top;
    for (const [t, b] of spans) {
      gap = Math.max(gap, t - reach);
      reach = Math.max(reach, b);
    }
    return Math.max(gap, box.bottom - reach);
  });

for (const vp of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
  test(`fits at ${vp.width}: no clipping, no void over 120px`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: vp, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/');
    const mp = page.getByTestId('main-problem');
    await expect(mp).toBeInViewport({ ratio: 1 });
    const card = (await mp.boundingBox())!;
    const rows = mp.getByTestId('driver-row');
    await expect(rows).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      const r = (await rows.nth(i).boundingBox())!;
      expect(r.y).toBeGreaterThanOrEqual(card.y);
      expect(r.y + r.height).toBeLessThanOrEqual(card.y + card.height + 0.5);
      // row content (name and share) is not truncated to nothing and not overflowing
      const over = await rows.nth(i).evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(over).toBeLessThanOrEqual(1);
    }
    expect(await mp.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
    expect(await largestVoid(page)).toBeLessThan(120);
    await ctx.close();
  });
}

test('non-H&S type and empty filter: no main problem card, no crash', async ({ page }) => {
  await page.goto('/?t=security');
  await expect(page.getByTestId('main-problem')).toHaveCount(0);
  await page.goto('/?q=Q4-2025&r=');
  await expect(page.getByTestId('main-problem')).toHaveCount(0);
  await expect(page.locator('text=NaN')).toHaveCount(0);
});

test('the Q4 filter titles the card with Q4 2025', async ({ page }) => {
  await page.goto('/?q=Q4-2025&r=SR1%2CSR2');
  await expect(page.getByTestId('main-problem-title')).toHaveText('Main Problem – Q4 2025');
  await expect(page.getByTestId('driver-row')).toHaveCount(4);
  await expect(page.getByTestId('main-problem-delta')).toHaveCount(0); // no previous quarter
});
