import { test, expect, type Page } from '@playwright/test';
import { getRepo } from '../../lib/data/repo';
import { contractorAudits, findingsByAudit, repeatMatrix } from '../../lib/analytics';
import { bandFor } from '../../lib/scoring';
import { cardVoids } from './voids';
import { expectNothingClipped } from './clip';

const ALL = { quarter: 'all' as const, regions: ['SR1', 'SR2'] as ('SR1' | 'SR2')[] };
const ID = '4800001131'; // JV-ECH: 2 audits
const SIBS = '4800000838'; // 3 audits
const NBC = '4200000026'; // 1 audit
const ROWS = contractorAudits(getRepo(), ALL, ID);
const SIZES = [{ width: 1366, height: 657 }, { width: 1366, height: 768 }, { width: 1920, height: 1080 }];
const CARDS = ['slide-header', 'category-gaps', 'top-repeats'];

/**
 * The top 3 repeated questions of a contractor, straight from repeatMatrix (quarter ignored, regions kept): most times
 * repeated first, then the most recent repeat (the later audit of the pair), then repeatMatrix's own question order.
 */
function expectedTop3(id: string) {
  const repo = getRepo();
  const m = repeatMatrix(repo, ALL);
  const row = m.cells[id] ?? {};
  // the latest audit in which the question repeated (a finding there and in the audit before)
  // one visit per quarter: a finding in either of a quarter's audits counts once
  const byQuarter = new Map<string, { audit: { date: string }; itemCodes: string[] }>();
  for (const f of findingsByAudit(repo, { ...ALL, contractorId: id })) {
    const v = byQuarter.get(f.audit.quarter);
    byQuarter.set(f.audit.quarter, { audit: f.audit, itemCodes: [...(v?.itemCodes ?? []), ...f.itemCodes] });
  }
  const found = [...byQuarter.values()];
  const last = (code: string) => {
    let d = '';
    for (let i = 1; i < found.length; i++) if (found[i].itemCodes.includes(code) && found[i - 1].itemCodes.includes(code)) d = found[i].audit.date;
    return d;
  };
  return m.questions
    .map((q, i) => ({ ...q, times: row[q.itemCode] ?? 0, i }))
    .filter((q) => q.times > 0)
    .sort((a, b) => b.times - a.times || last(b.itemCode).localeCompare(last(a.itemCode)) || a.i - b.i)
    .slice(0, 3);
}
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

for (const vp of SIZES) {
  test(`/contractor fits one screen at ${vp.width}×${vp.height}: chart on top, nothing clipped, no codes`, async ({ page }) => {
    await page.setViewportSize(vp);
    for (const id of [ID, SIBS, NBC]) {
      await page.goto(`/contractor/${id}`);
      await ready(page);
      await noPageScroll(page);
      await expect(page.getByTestId('score-trend')).toBeInViewport({ ratio: 1 });
      for (const card of CARDS) await expect(active(page).getByTestId(card)).toBeInViewport({ ratio: 1 });
      await expect(active(page).getByTestId('full-report')).toBeInViewport();
      // the chart sits above the slides
      const chart = (await page.getByTestId('score-trend').boundingBox())!;
      const slide = (await active(page).getByTestId('slide-header').boundingBox())!;
      expect(chart.y + chart.height).toBeLessThanOrEqual(slide.y);
      expect(await page.getByTestId('details').innerText()).not.toMatch(CODE);
      await expectNothingClipped(page, `/contractor/${id} at ${vp.width}×${vp.height}`);
    }
    // swiping to the earlier audit keeps the page still
    await page.goto(`/contractor/${ID}`);
    await ready(page);
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/[?&]s=1(&|$)/);
    await noPageScroll(page);
    await expectNothingClipped(page, `/contractor/${ID}?s=1 at ${vp.width}×${vp.height}`);
  });
}

test('the score chart has one band-coloured point per audit in date order, a green line when the latest rose', async ({ page }) => {
  for (const [id, n] of [[ID, 2], [SIBS, 3], [NBC, 1]] as const) {
    const audits = getRepo().audits().filter((a) => a.contractorId === id).sort((a, b) => a.date.localeCompare(b.date));
    expect(audits).toHaveLength(n);
    await page.goto(`/contractor/${id}?q=Q4-2025`); // the quarter filter does not thin the chart
    await ready(page);
    const chart = page.getByTestId('score-trend');
    await expect(chart.getByTestId('score-trend-point')).toHaveCount(n);
    await expect(chart).toHaveAttribute('data-points', String(n));
    expect(await chart.getByTestId('score-trend-point').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-value')))))
      .toEqual(audits.map((a) => Math.round(a.totalScore * 100)));
    expect(await chart.getByTestId('score-trend-value').allInnerTexts()).toEqual(audits.map((a) => `${Math.round(a.totalScore * 100)}%`));
    // each point wears its band colour
    const colours = await chart.getByTestId('score-trend-point').evaluateAll((els) => els.map((e) => {
      const probe = document.createElement('span');
      const v = { Excellent: 'excellent', Good: 'good', 'Partially Compliant': 'partial', 'Minimally Compliant': 'minimal', 'Non-Compliant': 'non' }[e.getAttribute('data-band')!];
      probe.style.color = `var(--band-${v})`;
      document.body.append(probe);
      const want = getComputedStyle(probe).color;
      probe.remove();
      return [getComputedStyle(e.querySelector('[data-testid="score-trend-dot"]')!).backgroundColor, want];
    }));
    for (const [got, want] of colours) expect(got).toBe(want);
    expect(await chart.getByTestId('score-trend-point').evaluateAll((els) => els.map((e) => e.getAttribute('data-band'))))
      .toEqual(audits.map((a) => bandFor(a.totalScore)));
    if (n === 1) {
      await expect(chart).toHaveAttribute('data-trend', 'single');
      await expect(chart.getByTestId('score-trend-line')).toHaveCount(0);
      await expect(chart.getByTestId('score-trend-first')).toHaveText(/first audit/i);
    } else {
      // Computed from the Excel points: JV-ECH 76 → 74 fell (red, --down); SIBS 64 → 66 → 72 rose (green, --up)
      const dir = id === SIBS ? 'up' : 'down';
      await expect(chart).toHaveAttribute('data-trend', dir);
      const [stroke, up] = await chart.getByTestId('score-trend-line').evaluate((el, d) => {
        const probe = document.createElement('span');
        probe.style.color = `var(--${d})`;
        document.body.append(probe);
        const want = getComputedStyle(probe).color;
        probe.remove();
        return [getComputedStyle(el).stroke, want];
      }, dir);
      expect(stroke).toBe(up);
    }
  }
});

test('the chart follows the slide, and clicking the earlier point switches s', async ({ page }) => {
  await page.goto(`/contractor/${SIBS}`);
  await ready(page);
  const points = page.getByTestId('score-trend-point');
  await expect(points.nth(2)).toHaveAttribute('data-active', ''); // latest audit = slide 0
  await points.first().click(); // the earliest audit = the last slide
  await expect(page).toHaveURL(/[?&]s=2(&|$)/);
  await expect(page.getByTestId('carousel')).toHaveAttribute('data-index', '2');
  await expect(active(page).getByTestId('slide-score')).toHaveText('64%'); // SIBS 12 Nov 2025, computed from its points
  await expect(points.first()).toHaveAttribute('data-active', '');
  // keys move the chart's active point too
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(/[?&]s=1(&|$)/);
  await expect(points.nth(1)).toHaveAttribute('data-active', '');
  await points.nth(2).click();
  await expect(page).not.toHaveURL(/[?&]s=/);
  await expect(active(page).getByTestId('slide-score')).toHaveText('72%');
});

test('Top 3 repeated observations match repeatMatrix for JV-ECH and SIBS; NBC shows the empty state', async ({ page }) => {
  for (const id of [ID, SIBS]) {
    const want = expectedTop3(id);
    expect(want).toHaveLength(3);
    await page.goto(`/contractor/${id}`);
    await ready(page);
    const card = active(page).getByTestId('top-repeats');
    await expect(card.getByRole('heading')).toHaveText('Repeated');
    const rows = card.getByTestId('top-repeat');
    await expect(rows).toHaveCount(3);
    expect(await rows.evaluateAll((els) => els.map((e) => [e.getAttribute('data-item'), Number(e.getAttribute('data-times'))])))
      .toEqual(want.map((q) => [q.itemCode, q.times]));
    expect(await card.getByTestId('top-repeat-label').allInnerTexts()).toEqual(want.map((q) => q.label));
    expect(await card.getByTestId('top-repeat-times').allInnerTexts()).toEqual(want.map((q) => `${q.times}×`));
    for (let i = 0; i < 3; i++) {
      await expect(rows.nth(i)).toHaveAttribute('href', `/category/${want[i].category}/${id}/${want[i].itemCode}?q=all&r=SR1%2CSR2`);
    }
    // the marker: the quarters of the audits in which the question was a finding
    expect(await card.getByTestId('top-repeat-marker').allInnerTexts()).toEqual(want.map(() => 'Q4 → Q1'));
    await expect(card.getByTestId('top-repeats-empty')).toHaveCount(0);
  }
  await page.goto(`/contractor/${NBC}`);
  await ready(page);
  const card = active(page).getByTestId('top-repeats');
  await expect(card.getByTestId('top-repeat')).toHaveCount(0);
  await expect(card.getByTestId('top-repeats-empty')).toContainText('No earlier audit to compare');
  await expect(active(page).getByTestId('full-report')).toBeVisible();
});

test('a Top 3 row opens its question for the contractor', async ({ page }) => {
  await page.goto(`/contractor/${ID}`);
  await ready(page);
  const want = expectedTop3(ID)[0];
  await active(page).getByTestId('top-repeat').first().click();
  await expect(page).toHaveURL(new RegExp(`/category/${want.category}/${ID}/${want.itemCode.replace('.', '\\.')}\\?q=all`));
  await expect(page.getByTestId('item-title')).toHaveText(want.label);
});

test('each slide keeps its score, Full report link and A/B/C sections under the score figure', async ({ page }) => {
  await page.goto(`/contractor/${ID}`);
  await ready(page);
  for (let i = 0; i < ROWS.length; i++) {
    if (i) {
      await page.keyboard.press('ArrowRight');
      await expect(page.getByTestId('carousel')).toHaveAttribute('data-index', String(i));
    }
    const slide = active(page);
    await expect(slide.getByTestId('slide-score')).toHaveText(`${Math.round(ROWS[i].audit.totalScore * 100)}%`);
    await expect(slide.getByTestId('full-report')).toHaveAttribute('href', new RegExp(`^/audit/${ROWS[i].audit.id}\\?`));
    const score = (await slide.getByTestId('slide-score').boundingBox())!;
    const bars = (await slide.getByRole('list', { name: 'Section scores' }).boundingBox())!;
    expect(bars.y).toBeGreaterThan(score.y + score.height);
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

for (const vp of SIZES) {
  test(`/contractor cards have no empty void over 80px at ${vp.width}×${vp.height}`, async ({ page }) => {
    await page.setViewportSize(vp);
    for (const url of [`/contractor/${ID}`, `/contractor/${ID}?s=1`, `/contractor/${SIBS}`, `/contractor/${NBC}`]) {
      await page.goto(url);
      await ready(page);
      await page.waitForTimeout(1200); // entrance settles
      const voids = await cardVoids(active(page));
      expect(voids.map((v) => v.card)).toEqual(CARDS);
      for (const v of voids) expect(v.void, `${url} ${v.card}`).toBeLessThanOrEqual(80);
      await noPageScroll(page);
    }
  });
}
