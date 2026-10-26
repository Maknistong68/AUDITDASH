import { test, expect, type Page } from '@playwright/test';
import { getRepo } from '../../lib/data/repo';
import { categoryGaps } from '../../lib/analytics';
import { CATEGORIES } from '../../lib/categories';

const ALL = { quarter: 'all' as const, regions: ['SR1', 'SR2'] as ('SR1' | 'SR2')[] };
const Q = 'q=all&r=SR1%2CSR2';
/** "Where it fails" order: worst gap first. */
const ORDER = [...categoryGaps(getRepo(), ALL)].sort((a, b) => (b.gapRate ?? -1) - (a.gapRate ?? -1)).map((g) => g.category);

const slider = (page: Page) => page.getByTestId('category-slider');
const cards = (page: Page) => slider(page).getByTestId('gap-tile');
const activeCard = (page: Page) => slider(page).locator('[data-testid="gap-tile"][data-active]');
const ready = (page: Page) => expect(slider(page)).toHaveAttribute('data-ready', '');
const catUrl = (id: string) => new RegExp(`/category/${id}\\?${Q}$`);

test('the dashboard no longer has "Where it fails" or any gap tile', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('reel-card')).toHaveCount(20);
  await expect(page.getByRole('heading', { name: 'Where it fails' })).toHaveCount(0);
  await expect(page.getByText('Where it fails')).toHaveCount(0);
  await expect(page.getByTestId('gap-tile')).toHaveCount(0);
  await expect(page.getByTestId('main-issues')).toBeVisible();
  await expect(page.getByTestId('reel')).toBeAttached();
});

test('the category page shows the 8 categories worst gap first, the URL category active and centred', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const id = ORDER[2];
  await page.goto(`/category/${id}?${Q}`);
  await ready(page);
  await expect(cards(page)).toHaveCount(CATEGORIES.length);
  expect(CATEGORIES.length).toBe(8);
  expect(await cards(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-cat')))).toEqual(ORDER);
  await expect(activeCard(page)).toHaveCount(1);
  await expect(activeCard(page)).toHaveAttribute('data-cat', id);
  await expect(activeCard(page)).toHaveAttribute('aria-current', 'page');
  // the slider sits under the breadcrumb, above the existing content
  const crumb = (await page.getByTestId('breadcrumb').boundingBox())!;
  const box = (await slider(page).boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(crumb.y + crumb.height - 1);
  expect(box.y + box.height).toBeLessThanOrEqual((await page.getByTestId('category-title').boundingBox())!.y + 1);
  // centred and fully opaque; neighbours dimmed
  await page.waitForTimeout(700);
  const a = (await activeCard(page).boundingBox())!;
  expect(Math.abs(a.x + a.width / 2 - 1920 / 2)).toBeLessThan(4);
  const op = await cards(page).evaluateAll((els) => els.map((e) => Number(getComputedStyle(e.parentElement!).opacity)));
  expect(op[2]).toBe(1);
  for (const [i, o] of op.entries()) if (i !== 2) expect(o).toBeLessThan(1);
  // edges fade out via a mask gradient
  expect(await slider(page).locator('div[style*="mask-image"]').count()).toBe(1);
  // tile content: rank, name, gap %, findings
  await expect(activeCard(page)).toContainText('3');
  await expect(activeCard(page)).toContainText(/\d+%\s*gap/);
  await expect(activeCard(page)).toContainText(/\d+ findings?/);
});

test('ArrowRight and the next button go to the next category, keeping the filter', async ({ page }) => {
  await page.goto(`/category/${ORDER[0]}?${Q}`);
  await ready(page);
  await expect(page.getByTestId('carousel')).toHaveAttribute('data-ready', '');
  const quarter = await page.getByTestId('carousel').getAttribute('data-index');
  await activeCard(page).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(catUrl(ORDER[1]));
  await ready(page);
  await expect(activeCard(page)).toHaveAttribute('data-cat', ORDER[1]);
  // the quarter carousel below kept its slide (the slider took the key)
  await expect(page.getByTestId('carousel')).toHaveAttribute('data-index', quarter!);
  await page.getByRole('button', { name: 'Next category' }).click();
  await expect(page).toHaveURL(catUrl(ORDER[2]));
  await expect(activeCard(page)).toHaveAttribute('data-cat', ORDER[2]);
  await page.getByRole('button', { name: 'Previous category' }).click();
  await expect(page).toHaveURL(catUrl(ORDER[1]));
});

test('selecting a card keeps the filter (q, r) in the URL', async ({ page }) => {
  await page.goto(`/category/${ORDER[0]}?q=Q1-2026&r=SR1`);
  await ready(page);
  await expect(cards(page).nth(1)).toHaveAttribute('href', new RegExp(`^/category/[a-z]+\\?q=Q1-2026&r=SR1`));
  const target = (await cards(page).nth(1).getAttribute('data-cat'))!;
  await cards(page).nth(1).click();
  await expect(page).toHaveURL(new RegExp(`/category/${target}\\?q=Q1-2026&r=SR1$`));
  await expect(activeCard(page)).toHaveAttribute('data-cat', target);
});

test('dragging the slider moves to the next category', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`/category/${ORDER[3]}?${Q}`);
  await ready(page);
  const a = (await activeCard(page).boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 - 140, a.y + a.height / 2, { steps: 12 });
  await page.mouse.move(a.x + a.width / 2 - 280, a.y + a.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page).toHaveURL(catUrl(ORDER[4]));
  await expect(activeCard(page)).toHaveAttribute('data-cat', ORDER[4]);
  // and back the other way
  await ready(page);
  const b = (await activeCard(page).boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 280, b.y + b.height / 2, { steps: 20 });
  await page.mouse.up();
  await expect(page).toHaveURL(catUrl(ORDER[3]));
});

test('reduced motion: no animation, still navigates', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(`/category/${ORDER[0]}?${Q}`);
  await ready(page);
  expect(await activeCard(page).evaluate((e) => getComputedStyle(e.parentElement!).transitionDuration)).toMatch(/^0s/);
  await page.getByRole('button', { name: 'Next category' }).click();
  await expect(page).toHaveURL(catUrl(ORDER[1]));
  await activeCard(page).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(catUrl(ORDER[2]));
  await expect(activeCard(page)).toHaveAttribute('data-cat', ORDER[2]);
  await ctx.close();
});

for (const vp of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) test(`category page: no horizontal document scroll at ${vp.width}`, async ({ page }) => {
  await page.setViewportSize(vp);
  await page.goto(`/category/${ORDER[0]}?${Q}`);
  await ready(page);
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto(`/category/${ORDER[ORDER.length - 1]}?${Q}`);
  await ready(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('text=NaN')).toHaveCount(0);
});
