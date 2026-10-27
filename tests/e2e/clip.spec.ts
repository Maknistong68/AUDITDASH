import { test } from '@playwright/test';
import { getRepo } from '../../lib/data/repo';
import { CATEGORIES } from '../../lib/categories';
import { repeatQuestions } from '../../lib/analytics';
import { expectNothingClipped } from './clip';

/**
 * One-screen guarantee, measured: on every one-screen view, at real laptop and desktop heights, no visible text or bar
 * is cut off by an ancestor that hides overflow. Light theme at four sizes, dark at 1366×657; at 1024×768 and 390×844
 * the page may scroll, but nothing may be unreachable.
 */
const repo = getRepo();
const contractors = repo.contractors().map((c) => c.id);
// The deepest one-screen drills: the top repeated question at its first contractor.
const top = repeatQuestions(repo, { quarter: 'all', regions: ['SR1', 'SR2'] })[0];
const ROUTES = [
  '/', '/repeats', '/positives', '/audits',
  ...CATEGORIES.map((c) => `/category/${c.id}`),
  ...contractors.map((id) => `/contractor/${id}`),
  `/category/${top.category}/${top.contractors[0].id}`,
  `/category/${top.category}/${top.contractors[0].id}/${encodeURIComponent(top.itemCode)}`,
];
const SIZES: { w: number; h: number; theme: 'light' | 'dark' }[] = [
  { w: 1366, h: 768, theme: 'light' },
  { w: 1366, h: 657, theme: 'light' },
  { w: 1920, h: 1080, theme: 'light' },
  { w: 1280, h: 600, theme: 'light' },
  { w: 1366, h: 657, theme: 'dark' },
  { w: 1024, h: 768, theme: 'light' },
  { w: 390, h: 844, theme: 'light' },
];

test.use({ reducedMotion: 'reduce' });

for (const route of ROUTES) {
  test(`nothing is cut off on ${route}`, async ({ page }) => {
    test.setTimeout(90_000);
    for (const { w, h, theme } of SIZES) {
      await page.setViewportSize({ width: w, height: h });
      await page.emulateMedia({ colorScheme: theme });
      await page.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch { /* private mode */ } }, theme);
      await page.goto(route);
      await expectNothingClipped(page, `${route} at ${w}×${h} ${theme}`);
    }
  });
}
