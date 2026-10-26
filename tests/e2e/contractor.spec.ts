import { test, expect, type Page } from '@playwright/test';
import { getRepo } from '../../lib/data/repo';
import { auditFindings, contractorAudits } from '../../lib/analytics';

const ALL = { quarter: 'all' as const, regions: ['SR1', 'SR2'] as ('SR1' | 'SR2')[] };
const ID = '4800001131';
const ROWS = contractorAudits(getRepo(), ALL, ID);
const CODE = /\b[ABC]\d+(\.\d+)?\b/;

const active = (page: Page) => page.locator('[data-testid="slide"][data-active]');
const ready = (page: Page) => expect(page.getByTestId('carousel')).toHaveAttribute('data-ready', '');

async function noPageScroll(page: Page) {
  const [sh, ih, sw, iw] = await page.evaluate(() => [
    document.documentElement.scrollHeight, innerHeight, document.documentElement.scrollWidth, innerWidth,
  ]);
  expect(sh).toBeLessThanOrEqual(ih);
  expect(sw).toBeLessThanOrEqual(iw);
}

for (const vp of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
  test(`/contractor fits one screen at ${vp.width}: no page scroll, every block in view, no codes`, async ({ page }) => {
    await page.setViewportSize(vp);
    await page.goto(`/contractor/${ID}`);
    await ready(page);
    await noPageScroll(page);
    for (const id of ['slide-header', 'category-gaps', 'findings']) await expect(active(page).getByTestId(id)).toBeInViewport({ ratio: 1 });
    await expect(active(page).getByTestId('full-report')).toBeInViewport();
    expect(await page.getByTestId('details').innerText()).not.toMatch(CODE);
    // swiping to the earlier audit keeps the page still
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/[?&]s=1(&|$)/);
    await noPageScroll(page);
  });
}

test('each slide shows observation counts per category that sum to its total, and a Full report link', async ({ page }) => {
  await page.goto(`/contractor/${ID}`);
  await ready(page);
  for (let i = 0; i < ROWS.length; i++) {
    if (i) {
      await page.keyboard.press('ArrowRight');
      await expect(page.getByTestId('carousel')).toHaveAttribute('data-index', String(i));
    }
    const slide = active(page);
    const { groups } = auditFindings(getRepo(), ROWS[i].audit);
    const total = groups.reduce((n, g) => n + g.observations.length, 0);
    await expect(slide.getByTestId('findings-total')).toHaveText(String(total));
    const counts = await slide.getByTestId('obs-count').evaluateAll((els) => els.map((e) => [e.getAttribute('data-category'), Number(e.getAttribute('data-count'))] as const));
    expect(counts).toEqual(groups.map((g) => [g.category, g.observations.length]));
    expect(counts.reduce((n, [, c]) => n + c, 0)).toBe(total);
    await expect(slide.getByTestId('obs-count').first()).toHaveAccessibleName(/: \d+ observations?$/);
    await expect(slide.getByTestId('full-report')).toHaveAttribute('href', new RegExp(`^/audit/${ROWS[i].audit.id}\\?`));
  }
});

test('a dashboard Contractors row opens its page with a ~1 s hand-off: name and score morph into the header', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await expect(page.getByTestId('contractors')).toHaveAttribute('data-hydrated', '');
  // no shared-element name at rest
  expect(await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('*')].filter((e) => getComputedStyle(e).viewTransitionName.startsWith('ct-')).length)).toBe(0);
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
  const link = page.locator(`[data-testid="contractor-row"] a[href^="/contractor/${ID}"]`);
  const score = /, (\d+)%, /.exec((await link.getAttribute('aria-label'))!)![1];
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/contractor/${ID}$`));
  await ready(page);
  await expect(active(page).getByTestId('slide-score')).toHaveText(`${score}%`);
  const w = () =>
    page.evaluate(() => {
      const x = window as unknown as { handoffs: number; durations: Record<string, number> };
      return { handoffs: x.handoffs, durations: x.durations };
    });
  await expect.poll(async () => Object.keys((await w()).durations).length).toBeGreaterThan(0);
  const { handoffs, durations } = await w();
  expect(handoffs).toBe(1);
  expect(durations['::view-transition-group(ct-name)']).toBeGreaterThanOrEqual(900);
  expect(durations['::view-transition-group(ct-score)']).toBeGreaterThanOrEqual(900);
  // landed: nothing running, the names only on the page title and the opened audit's score
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter((a) => (a.effect as KeyframeEffect | null)?.pseudoElement).length)).toBe(0);
  const named = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('*')]
      .filter((e) => getComputedStyle(e).viewTransitionName.startsWith('ct-'))
      .map((e) => [getComputedStyle(e).viewTransitionName, e.textContent]),
  );
  expect(named.sort()).toEqual([['ct-name', 'JV-ECH (Port T1)'], ['ct-score', `${score}%`]].sort());
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('JV-ECH (Port T1)');
});

test('reduced motion: a Contractors row still opens the contractor page', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.getByTestId('contractors')).toHaveAttribute('data-hydrated', '');
  await page.locator(`[data-testid="contractor-row"] a[href^="/contractor/${ID}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/contractor/${ID}$`));
  await ready(page);
  await ctx.close();
});
