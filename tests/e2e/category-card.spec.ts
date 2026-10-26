import { test, expect, type Page } from '@playwright/test';
import { getRepo } from '../../lib/data/repo';
import { categoryCards } from '../../lib/analytics';
import { CATEGORIES } from '../../lib/categories';

const ALL = { quarter: 'all' as const, regions: ['SR1', 'SR2'] as ('SR1' | 'SR2')[] };
const Q = 'q=all&r=SR1%2CSR2';
/** Ranked by the latest quarter's gap, worst first: #1 is the dashboard's main problem. */
const ORDER = categoryCards(getRepo(), ALL).map((c) => c.category);

const card = (page: Page) => page.getByTestId('category-card');
const ready = (page: Page) => expect(page.getByTestId('category-deck')).toHaveAttribute('data-ready', '');
const catUrl = (id: string, q = Q) => new RegExp(`/category/${id}\\?${q}$`);

/** Press on the card's middle, move by dx in small steps, release. */
async function drag(page: Page, dx: number, steps = 16) {
  const b = (await card(page).boundingBox())!;
  const x = b.x + b.width / 2;
  const y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x + (dx * i) / steps, y);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  return b;
}

test('the dashboard Main problem card opens a category page whose card is #1 with the same gap', async ({ page }) => {
  expect(ORDER).toHaveLength(CATEGORIES.length);
  await page.goto('/');
  const link = page.getByTestId('main-problem').getByRole('link');
  const gap = /gap (\d+)%/.exec((await link.getAttribute('aria-label'))!)![1];
  await link.click();
  await expect(page).toHaveURL(catUrl(ORDER[0]));
  await ready(page);
  await expect(card(page)).toHaveAttribute('data-rank', '1');
  await expect(card(page)).toContainText('#1 · Q1 2026');
  await expect(card(page).getByTestId('main-problem-gap')).toHaveText(`${gap}%`);
  await expect(card(page).getByRole('heading', { level: 1 })).toHaveText(CATEGORIES.find((c) => c.id === ORDER[0])!.name);
  await expect(card(page).getByTestId('main-problem-driver')).toHaveCount(3);
  await expect(page.getByTestId('category-position')).toHaveText(`1 / ${ORDER.length}`);
  // it replaces the old dark title tile: one dark card under the breadcrumb, no strip of small cards
  await expect(page.getByTestId('category-title')).toHaveCount(0);
  await expect(page.getByTestId('gap-tile')).toHaveCount(0);
  const crumb = (await page.getByTestId('breadcrumb').boundingBox())!;
  expect((await card(page).boundingBox())!.y).toBeGreaterThanOrEqual(crumb.y + crumb.height - 1);
});

test('dragging the card left past the threshold goes to the #2 category', async ({ page }) => {
  await page.goto(`/category/${ORDER[0]}?${Q}`);
  await ready(page);
  const b = (await card(page).boundingBox())!;
  await drag(page, -b.width * 0.4);
  await expect(page).toHaveURL(catUrl(ORDER[1]));
  await expect(card(page)).toHaveAttribute('data-rank', '2');
  await expect(card(page)).toContainText('#2 · Q1 2026');
  await expect(page.getByTestId('category-position')).toHaveText(`2 / ${ORDER.length}`);
  // and back with a right drag
  await drag(page, b.width * 0.4);
  await expect(page).toHaveURL(catUrl(ORDER[0]));
  await expect(card(page)).toHaveAttribute('data-rank', '1');
});

test('dragging right at #1 springs back and stays on #1', async ({ page }) => {
  await page.goto(`/category/${ORDER[0]}?${Q}`);
  await ready(page);
  const b = await drag(page, 400);
  await page.waitForTimeout(900);
  await expect(page).toHaveURL(catUrl(ORDER[0]));
  await expect(card(page)).toHaveAttribute('data-rank', '1');
  expect(Math.abs((await card(page).locator('article').boundingBox())!.x - b.x)).toBeLessThan(1.5);
});

test('a small drag springs back', async ({ page }) => {
  await page.goto(`/category/${ORDER[2]}?${Q}`);
  await ready(page);
  const b = await drag(page, -0.1 * (await card(page).boundingBox())!.width, 6);
  await page.waitForTimeout(900);
  await expect(page).toHaveURL(catUrl(ORDER[2]));
  await expect(card(page)).toHaveAttribute('data-rank', '3');
  expect(Math.abs((await card(page).locator('article').boundingBox())!.x - b.x)).toBeLessThan(1.5);
});

test('the Next / Previous buttons and the arrow keys move through the ranks, keeping the filter', async ({ page }) => {
  const q = 'q=Q1-2026&r=SR1';
  const order = categoryCards(getRepo(), { quarter: 'Q1-2026', regions: ['SR1'] }).map((c) => c.category);
  await page.goto(`/category/${order[0]}?${q}`);
  await ready(page);
  await expect(page.getByRole('button', { name: 'Previous category' })).toBeDisabled();
  await page.getByRole('button', { name: 'Next category' }).click();
  await expect(page).toHaveURL(catUrl(order[1], q));
  await expect(card(page)).toHaveAttribute('data-rank', '2');
  await page.getByRole('button', { name: 'Previous category' }).click();
  await expect(page).toHaveURL(catUrl(order[0], q));

  await ready(page);
  const quarters = page.getByTestId('carousel');
  await expect(quarters).toHaveAttribute('data-index', '0');
  await card(page).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(catUrl(order[1], q));
  await expect(card(page)).toHaveAttribute('data-rank', '2');
  await expect(card(page)).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(catUrl(order[2], q));
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(catUrl(order[1], q));
  // the quarter carousel below did not take those keys
  await expect(quarters).toHaveAttribute('data-index', '0');
});

test('the last category: Next is disabled and a left drag springs back', async ({ page }) => {
  const last = ORDER.at(-1)!;
  await page.goto(`/category/${last}?${Q}`);
  await ready(page);
  await expect(card(page)).toHaveAttribute('data-rank', String(ORDER.length));
  await expect(page.getByRole('button', { name: 'Next category' })).toBeDisabled();
  await drag(page, -400);
  await page.waitForTimeout(900);
  await expect(page).toHaveURL(catUrl(last));
});

for (const vp of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) test(`no horizontal document scroll at ${vp.width}, also mid-drag`, async ({ page }) => {
  await page.setViewportSize(vp);
  await page.goto(`/category/${ORDER[1]}?${Q}`);
  await ready(page);
  const noScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(await noScroll()).toBe(true);
  const b = (await card(page).boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + vp.width, b.y + b.height / 2, { steps: 10 });
  expect(await noScroll()).toBe(true);
  await page.mouse.up();
  await page.waitForTimeout(300);
  expect(await noScroll()).toBe(true);
  await expect(page).toHaveURL(catUrl(ORDER[0]));
  expect(await noScroll()).toBe(true);
});

test('reduced motion: buttons, keys and drags still navigate', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/category/${ORDER[0]}?${Q}`);
  await ready(page);
  await page.getByRole('button', { name: 'Next category' }).click();
  await expect(page).toHaveURL(catUrl(ORDER[1]));
  await card(page).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(catUrl(ORDER[2]));
  await ready(page);
  await drag(page, (await card(page).boundingBox())!.width * 0.4);
  await expect(page).toHaveURL(catUrl(ORDER[1]));
  await expect(card(page)).toHaveAttribute('data-rank', '2');
});

test('the dashboard Main problem card renders exactly as before the refactor', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const mp = page.getByTestId('main-problem');
  await expect(mp.getByTestId('main-problem-gap')).toHaveText('73%');
  // captured from the dashboard at b43b7ad, before the card was factored out
  await expect.poll(() => mp.innerText()).toBe(
    'Main problem · Q1 2026\n\nSubcontractor Control\n\n73%\n\ngap\n−2 pts\nvs Q4\n\nDriven by\n\n' +
      'Subcontractor screening & evaluation\n11 of 11 audits\nSubcontractor pre-start safety check\n11 of 11 audits\n' +
      'Subcontractor past safety record\n11 of 11 audits',
  );
  await expect(mp.getByRole('link')).toHaveAttribute('aria-label', 'Main problem Q1 2026: Subcontractor Control, gap 73%. Open details');
  await expect(mp.getByRole('heading', { level: 2 })).toHaveText('Subcontractor Control');
  await expect(mp.getByRole('heading', { level: 2 })).toHaveAttribute('id', 'mp-title');
  await expect(mp).not.toContainText('#');
});
