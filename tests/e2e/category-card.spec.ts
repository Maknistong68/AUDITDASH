import { test, expect, type Page } from '@playwright/test';
import { getRepo } from '../../lib/data/repo';
import { categoryCards, categoryQuarters } from '../../lib/analytics';
import { itemLabel } from '../../lib/itemLabels';
import { CATEGORIES } from '../../lib/categories';

const ALL = { quarter: 'all' as const, regions: ['SR1', 'SR2'] as ('SR1' | 'SR2')[] };
const Q = 'q=all&r=SR1%2CSR2';
/** Ranked by the latest quarter's gap, worst first: #1 is the dashboard's main problem. */
const RANKED = categoryCards(getRepo(), ALL);
const ORDER = RANKED.map((c) => c.category);
const nameOf = (id: string) => CATEGORIES.find((c) => c.id === id)!.name;

const cards = (page: Page) => page.getByTestId('category-card');
const active = (page: Page) => page.locator('[data-testid="category-card"][data-active]');
const ready = (page: Page) => expect(page.getByTestId('category-deck')).toHaveAttribute('data-ready', '');
const catUrl = (id: string, q = Q) => new RegExp(`/category/${id}\\?${q}$`);
/** Left edge of the content column: the quarter carousel's first slide (same gutter as the breadcrumb). */
const columnLeft = async (page: Page) => (await page.getByTestId('slide').first().boundingBox())!.x;
/** Each card's effective opacity (its list item fades by distance from the active card). */
const opacities = (page: Page) =>
  cards(page).evaluateAll((els) =>
    els.map((e) => {
      let o = 1;
      for (let n: Element | null = e; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
      return o;
    }),
  );

/** Press on the active card, move by dx in small steps, hold still (no flick momentum), release. */
async function drag(page: Page, dx: number, steps = 16) {
  const b = (await active(page).boundingBox())!;
  const x = b.x + b.width / 2;
  const y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x + (dx * i) / steps, y);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(150);
  await page.mouse.up();
  return b;
}

test('clicking the dashboard Main problem card lands on its category, the active carousel card #1 with the same gap', async ({ page }) => {
  expect(ORDER).toHaveLength(CATEGORIES.length);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  const link = page.getByTestId('main-problem').getByRole('link');
  const gap = /(\d+)% score lost/.exec((await link.getAttribute('aria-label'))!)![1];
  // count the shared-element transitions the click starts
  await page.evaluate(() => {
    const w = window as unknown as { handoffs: number };
    w.handoffs = 0;
    const start = document.startViewTransition.bind(document);
    document.startViewTransition = ((cb: ViewTransitionUpdateCallback) => {
      w.handoffs++;
      return start(cb);
    }) as typeof document.startViewTransition;
  });
  await link.click();
  await expect(page).toHaveURL(catUrl(ORDER[0]));
  await ready(page);
  expect(await page.evaluate(() => (window as unknown as { handoffs: number }).handoffs)).toBe(1);
  await expect(active(page)).toHaveAttribute('data-rank', '1');
  await expect(active(page)).toHaveAttribute('aria-current', 'page');
  await expect(active(page)).toContainText('#1');
  await expect(active(page)).toContainText(nameOf(ORDER[0]));
  await expect(active(page).getByTestId('category-card-gap')).toHaveText(`${gap}%`);
  await expect(active(page)).toHaveAccessibleName(`#1 ${nameOf(ORDER[0])}, ${gap}% score lost`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(nameOf(ORDER[0]));
  // the hand-off landed: no view transition left running, one card carries the shared name
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter((a) => (a.effect as KeyframeEffect | null)?.pseudoElement).length)).toBe(0);
  expect(await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('*')].filter((e) => getComputedStyle(e).viewTransitionName === 'mp-card').length)).toBe(1);
});

test('the compact card: essentials only, at most 55% of the dashboard card width at 1920', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  const big = (await page.getByTestId('main-problem').boundingBox())!;
  await page.goto(`/category/${ORDER[0]}?${Q}`);
  await ready(page);
  const small = (await active(page).boundingBox())!;
  expect(small.width).toBeLessThanOrEqual(big.width * 0.55);
  expect(small.height).toBeLessThanOrEqual(big.height * 0.55);
  // rank, name, gap %, Δ vs Q4; no "Driven by" rows
  const c = RANKED[0];
  const d = Math.round(c.gapRate * 100) - Math.round(c.prevGapRate! * 100);
  await expect(active(page)).toHaveText(
    `#1${nameOf(ORDER[0])}${Math.round(c.gapRate * 100)}%score lost${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)} ${Math.abs(d) === 1 ? 'pt' : 'pts'}vs Q4`,
  );
  await expect(page.getByTestId('main-problem-driver')).toHaveCount(0);
  await expect(page.getByTestId('category-deck')).not.toContainText('Driven by');
});

test('the carousel: one same-size card per category, worst first, no counter, dots or arrow buttons', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`/category/${ORDER[2]}?${Q}`);
  await ready(page);
  await expect(cards(page)).toHaveCount(8);
  for (let i = 0; i < 8; i++) {
    await expect(cards(page).nth(i)).toHaveAttribute('data-rank', String(i + 1));
    await expect(cards(page).nth(i)).toHaveAttribute('data-cat', ORDER[i]);
    await expect(cards(page).nth(i)).toHaveAccessibleName(`#${i + 1} ${nameOf(ORDER[i])}, ${Math.round(RANKED[i].gapRate * 100)}% score lost`);
  }
  const boxes = await cards(page).evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => [r.width, r.height]));
  for (const [w, h] of boxes) {
    expect(Math.abs(w - boxes[0][0])).toBeLessThanOrEqual(1);
    expect(Math.abs(h - boxes[0][1])).toBeLessThanOrEqual(1);
  }
  // the active card is fully opaque and sits at the left edge of the content column; the ones after it fade with distance
  await expect(active(page)).toHaveAttribute('data-rank', '3');
  const o = await opacities(page);
  expect(o[2]).toBe(1);
  expect(o[3]).toBeGreaterThan(o[4]);
  expect(o[4]).toBeGreaterThan(o[5]);
  expect(o[5]).toBeGreaterThan(o[6]);
  expect(o[7]).toBeLessThan(0.05);
  expect(o[1]).toBeLessThan(0.05); // #2, slid out to the left
  const a = (await active(page).boundingBox())!;
  expect(Math.abs(a.x - (await columnLeft(page)))).toBeLessThanOrEqual(2);

  const deck = page.getByTestId('category-deck');
  await expect(deck).not.toContainText('/ 8');
  await expect(page.getByTestId('category-position')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /category/i })).toHaveCount(0);
  await expect(deck.locator('.rounded-full')).toHaveCount(0);
  // the edges fade out
  const mask = await page.getByTestId('category-carousel').evaluate((e) => {
    const s = getComputedStyle(e);
    return s.maskImage || s.webkitMaskImage;
  });
  expect(mask).not.toBe('none');
  expect(mask).toContain('linear-gradient');
});

test('at #1 the active card is anchored left, and the fade makes #2 clearer than #3, #3 than #4', async ({ page }) => {
  for (const vp of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(vp);
    await page.goto(`/category/${ORDER[0]}?${Q}`);
    await ready(page);
    const a = (await active(page).boundingBox())!;
    expect(Math.abs(a.x - (await columnLeft(page)))).toBeLessThanOrEqual(2);
    const crumb = (await page.getByTestId('breadcrumb').boundingBox())!;
    expect(Math.abs(a.x - crumb.x)).toBeLessThanOrEqual(2);
    const o = await opacities(page);
    expect(o[0]).toBe(1);
    expect(o[1]).toBeGreaterThan(0.6);
    expect(o[1]).toBeGreaterThan(o[2]);
    expect(o[2]).toBeGreaterThan(o[3]);
    expect(o[3]).toBeGreaterThan(o[4]);
    expect(o[4]).toBeLessThan(0.05);
  }
});

test('clicking card #3 opens its category, keeping the filter, and it becomes active at the left edge', async ({ page }) => {
  const q = 'q=Q1-2026&r=SR1';
  const order = categoryCards(getRepo(), { quarter: 'Q1-2026', regions: ['SR1'] }).map((c) => c.category);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`/category/${order[0]}?${q}`);
  await ready(page);
  await cards(page).nth(2).click();
  await expect(page).toHaveURL(catUrl(order[2], q));
  await expect(active(page)).toHaveAttribute('data-rank', '3');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(nameOf(order[2]));
  // it glides into the active slot at the content column's left edge
  const left = await columnLeft(page);
  await expect.poll(async () => Math.abs((await active(page).boundingBox())!.x - left) <= 2).toBe(true);
});

test('dragging the carousel then releasing snaps to a card and navigates', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`/category/${ORDER[0]}?${Q}`);
  await ready(page);
  const b = (await active(page).boundingBox())!;
  // about one and a bit cards to the left: lands on #2
  await drag(page, -b.width * 1.1, 24);
  await expect(page).toHaveURL(catUrl(ORDER[1]));
  await expect(active(page)).toHaveAttribute('data-rank', '2');
  await expect.poll(async () => Math.round((await active(page).boundingBox())!.x)).toBe(Math.round(b.x));
  // a small drag springs back and stays
  await drag(page, -b.width * 0.15, 6);
  await page.waitForTimeout(900);
  await expect(page).toHaveURL(catUrl(ORDER[1]));
  expect(Math.abs((await active(page).boundingBox())!.x - b.x)).toBeLessThan(1.5);
  // dragging right past #1 stays on #1
  await drag(page, b.width * 3, 20);
  await expect(page).toHaveURL(catUrl(ORDER[0]));
  await expect(active(page)).toHaveAttribute('data-rank', '1');
});

test('ArrowRight on the carousel moves to #2 (and on), ArrowLeft back; the quarter carousel below ignores them', async ({ page }) => {
  await page.goto(`/category/${ORDER[0]}?${Q}`);
  await ready(page);
  const quarters = page.getByTestId('carousel');
  await expect(quarters).toHaveAttribute('data-index', '0');
  await active(page).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(catUrl(ORDER[1]));
  await expect(active(page)).toHaveAttribute('data-rank', '2');
  await expect(active(page)).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(catUrl(ORDER[2]));
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(catUrl(ORDER[1]));
  await expect(active(page)).toBeFocused();
  await expect(quarters).toHaveAttribute('data-index', '0');
  // the cards are links; only the active one is in the tab order
  await expect(active(page)).toHaveAttribute('tabindex', '0');
  await expect(page.locator('[data-testid="category-card"][tabindex="0"]')).toHaveCount(1);
});

test('reduced motion: the dashboard card, clicks, keys and drags still navigate', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByTestId('main-problem').getByRole('link').click();
  await expect(page).toHaveURL(catUrl(ORDER[0]));
  await ready(page);
  await cards(page).nth(1).click();
  await expect(page).toHaveURL(catUrl(ORDER[1]));
  await ready(page);
  await active(page).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(catUrl(ORDER[2]));
  await ready(page);
  await drag(page, (await active(page).boundingBox())!.width * 1.1, 20);
  await expect(page).toHaveURL(catUrl(ORDER[1]));
  await expect(active(page)).toHaveAttribute('data-rank', '2');
});

for (const vp of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) test(`no horizontal document scroll at ${vp.width}, also mid-drag; the row fits`, async ({ page }) => {
  await page.setViewportSize(vp);
  await page.goto(`/category/${ORDER[1]}?${Q}`);
  await ready(page);
  const noScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(await noScroll()).toBe(true);
  const a = (await active(page).boundingBox())!;
  expect(a.x).toBeGreaterThanOrEqual(0);
  expect(a.x + a.width).toBeLessThanOrEqual(vp.width);
  // the card sits under the breadcrumb, before the quarter carousel
  const crumb = (await page.getByTestId('breadcrumb').boundingBox())!;
  expect(a.y).toBeGreaterThanOrEqual(crumb.y + crumb.height - 1);
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + vp.width, a.y + a.height / 2, { steps: 10 });
  expect(await noScroll()).toBe(true);
  await page.mouse.up();
  await expect(page).toHaveURL(catUrl(ORDER[0]));
  expect(await noScroll()).toBe(true);
});

test('the dashboard Main problem card renders exactly as before the refactor', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const mp = page.getByTestId('main-problem');
  await expect(mp.getByTestId('main-problem-gap')).toHaveText('73%');
  // captured from the dashboard at b43b7ad, before the card was factored out; "gap" became "score lost" (one-page step)
  await expect.poll(() => mp.innerText()).toBe(
    'Main problem · Q1 2026\n\nSubcontractor Control\n\n73%\n\nscore lost\n−2 pts\nvs Q4\n\nDriven by\n\n' +
      'Subcontractor screening & evaluation\n11 of 11 audits\nSubcontractor pre-start safety check\n11 of 11 audits\n' +
      'Subcontractor past safety record\n11 of 11 audits',
  );
  await expect(mp.getByRole('link')).toHaveAttribute('aria-label', 'Main problem Q1 2026: Subcontractor Control, 73% score lost. Open details');
  await expect(mp.getByRole('heading', { level: 2 })).toHaveText('Subcontractor Control');
  await expect(mp.getByRole('heading', { level: 2 })).toHaveAttribute('id', 'mp-title');
  await expect(mp).not.toContainText('#');
  // no shared-element name at rest: it is set only for the moment of the hand-off
  expect(await mp.evaluate((e) => getComputedStyle(e).viewTransitionName)).toBe('none');
});

const CODE = /\b[ABC]\d+(\.\d+)?\b/;
const slide = (page: Page) => page.locator('[data-testid="slide"][data-active]');
const quartersReady = (page: Page) => expect(page.getByTestId('carousel')).toHaveAttribute('data-ready', '');
async function noPageScroll(page: Page) {
  const [sh, ih, sw, iw] = await page.evaluate(() => [
    document.documentElement.scrollHeight, innerHeight, document.documentElement.scrollWidth, innerWidth,
  ]);
  expect(sh).toBeLessThanOrEqual(ih);
  expect(sw).toBeLessThanOrEqual(iw);
}

for (const vp of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
  test(`/category fits one screen at ${vp.width}: carousel on top, every block in view, no codes or sentences`, async ({ page }) => {
    await page.setViewportSize(vp);
    await page.goto(`/category/subcontractor?${Q}`);
    await ready(page);
    await quartersReady(page);
    await noPageScroll(page);
    await expect(active(page)).toBeInViewport({ ratio: 1 });
    for (const id of ['slide-header', 'ranked-contractors', 'driving-items']) await expect(slide(page).getByTestId(id)).toBeInViewport({ ratio: 1 });
    const text = await page.getByTestId('details').innerText();
    expect(text).not.toMatch(CODE);
    expect(text).not.toContain('averaged over');
    expect(text).not.toContain('?');
    // the visible contractor rows sit inside their card
    const card = (await slide(page).getByTestId('ranked-contractors').boundingBox())!;
    for (const b of await slide(page).locator('[data-testid="contractor-row"]:visible').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().bottom)))
      expect(b).toBeLessThanOrEqual(card.y + card.height);
    // the earlier quarter keeps the page still too
    await page.getByRole('button', { name: 'Previous quarter' }).click();
    await expect(page).toHaveURL(/s=1/);
    await noPageScroll(page);
  });
}

test('the drivers are plain labels with a bar and "N of M audits", in impact order', async ({ page }) => {
  const q = categoryQuarters(getRepo(), ALL, 'subcontractor')[0];
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`/category/subcontractor?${Q}`);
  await quartersReady(page);
  const items = slide(page).getByTestId('driving-item');
  await expect(items).toHaveCount(q.items.length);
  for (let i = 0; i < q.items.length; i++) {
    await expect(items.nth(i).getByTestId('driving-item-label')).toHaveText(itemLabel(q.items[i].itemCode, q.items[i].question));
    await expect(items.nth(i).getByTestId('driving-item-count')).toHaveText(`${q.items[i].hits} of ${q.audits} audits`);
    await expect(items.nth(i).locator('span[aria-hidden]')).toHaveCount(1); // the bar
  }
  await expect(slide(page).getByTestId('driving-items')).not.toContainText(CODE);
});

test('"+M more" expands a long list in place, scrolling inside its card, never the page', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const q = categoryQuarters(getRepo(), ALL, 'documents')[0];
  await page.goto(`/category/documents?${Q}`);
  await quartersReady(page);
  const list = slide(page).getByTestId('driver-list');
  const more = slide(page).getByTestId('driver-list-more');
  await expect(more).toBeVisible();
  const shown = await list.locator('[data-testid="driving-item"]:visible').count();
  expect(shown).toBeLessThan(q.items.length);
  await expect(more).toHaveText(`+${q.items.length - shown} more`);
  await more.click();
  await expect(list).toHaveAttribute('data-open', '');
  await expect(list.locator('[data-testid="driving-item"]:visible')).toHaveCount(q.items.length);
  await noPageScroll(page);
  expect(await list.evaluate((e) => e.scrollHeight > e.clientHeight && getComputedStyle(e).overflowY === 'auto')).toBe(true);
  await list.evaluate((e) => e.scrollTo(0, e.scrollHeight));
  await expect(list.getByTestId('driving-item').last()).toBeInViewport();
  await noPageScroll(page);
  await more.click();
  await expect(list.locator('[data-testid="driving-item"]:visible')).toHaveCount(shown);
  // the contractor list does the same when it is cut
  const cmore = slide(page).getByTestId('contractor-list-more');
  if (await cmore.count()) {
    await cmore.click();
    await expect(slide(page).getByTestId('contractor-row').filter({ visible: true })).toHaveCount(q.contractors.length);
    await noPageScroll(page);
  }
});

test('a deep link to a driver the card hides opens the list on it', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const q = categoryQuarters(getRepo(), ALL, 'documents')[0];
  const code = q.items.at(-1)!.itemCode;
  await page.goto(`/category/documents?${Q}#item-${code}`);
  await quartersReady(page);
  await expect(slide(page).getByTestId('driver-list')).toHaveAttribute('data-open', '');
  await expect(page.locator(`[id="item-${code}"]`)).toBeInViewport();
  await noPageScroll(page);
});
