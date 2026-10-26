import { expect, type Page } from '@playwright/test';

export interface Clipped {
  what: string;
  by: string;
  /** How many px of the thing are cut off. */
  cut: number;
}

/**
 * Everything visible on the page that an ancestor with `overflow: hidden | clip` cuts off: every non-empty text node
 * (its Range rects) and every bar (a filled leaf element: bars, dots, chips) is compared against the rect of each
 * clipping ancestor. An ancestor that scrolls (`auto | scroll`) makes its content reachable: above it, the scroller's own
 * box is checked instead. Not clipping: text truncated with an ellipsis (`text-overflow: ellipsis` or `line-clamp`, the
 * full text in its `title` or one click away), horizontal clipping by a carousel viewport
 * (`[data-clip-x]`: its slides are reached by swiping), inactive carousel slides (`[inert]`) and screen-reader-only
 * text. Text rects are trimmed by 20% of their height top and bottom, so a tight line-height is not a cut.
 * A fixed-height `main` with `overflow-hidden` makes `scrollHeight <= innerHeight` always true; this is the check that
 * can fail.
 */
export async function clippedContent(page: Page): Promise<Clipped[]> {
  return page.evaluate(() => {
    const TOL = 1;
    const out: { what: string; by: string; cut: number }[] = [];
    const name = (el: Element) => {
      const id = el.getAttribute('data-testid');
      const cls = typeof el.className === 'string' ? el.className.split(/\s+/).slice(0, 3).join('.') : '';
      return `${el.tagName.toLowerCase()}${id ? `[${id}]` : ''}${cls ? `.${cls}` : ''}`;
    };
    const hiddenEl = (el: Element) => {
      if (el.closest('[inert], [hidden], .sr-only')) return true;
      for (let e: Element | null = el; e; e = e.parentElement) {
        const s = getComputedStyle(e);
        if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return true;
        // screen-reader-only (Tailwind sr-only, also under a media variant): a clipped 1px absolute box
        if (s.position === 'absolute' && ((s.clip !== 'auto' && s.clip !== '') || s.clipPath.startsWith('inset(50%'))) return true;
      }
      return false;
    };
    const check = (el: Element, r0: DOMRect, what: string, isText: boolean) => {
      if (r0.width < 1 || r0.height < 1) return;
      let { left, right, top, bottom } = r0;
      if (isText) {
        const trim = r0.height * 0.2;
        top += trim;
        bottom -= trim;
      }
      // A text node's own element may clip it (overflow-hidden on the text's span); a bar's box is its own, so start above.
      for (let a = isText ? el : el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
        const s = getComputedStyle(a);
        const r = a.getBoundingClientRect();
        // A scroller makes what it holds reachable: from here on, the scroller itself must not be cut off.
        if (/(auto|scroll)/.test(s.overflowX + s.overflowY)) {
          ({ left, right, top, bottom } = r);
          continue;
        }
        // Designed truncation with an ellipsis: one line (text-overflow) or several (line-clamp); the full text is in a
        // title or one click away.
        const ellipsis = isText && (s.textOverflow === 'ellipsis' || (s.webkitLineClamp !== 'none' && s.webkitLineClamp !== ''));
        const clipX = /(hidden|clip)/.test(s.overflowX) && !a.hasAttribute('data-clip-x') && !ellipsis;
        const clipY = /(hidden|clip)/.test(s.overflowY) && !ellipsis;
        if (!clipX && !clipY) continue;
        let cut = 0;
        if (clipY) cut = Math.max(cut, r.top - top, bottom - r.bottom);
        if (clipX) cut = Math.max(cut, r.left - left, right - r.right);
        if (cut > TOL) {
          out.push({ what, by: name(a), cut: Math.round(cut) });
          return;
        }
      }
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n.textContent?.trim();
      const el = n.parentElement;
      if (!t || !el || el.closest('script, style, noscript, title') || hiddenEl(el)) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const rect of range.getClientRects()) check(el, rect, `text "${t.slice(0, 40)}" in ${name(el)}`, true);
    }
    for (const el of document.body.querySelectorAll('*')) {
      if (el.children.length || el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
      const s = getComputedStyle(el);
      if (/^(transparent|rgba\(.*,\s*0\))$/.test(s.backgroundColor) || hiddenEl(el)) continue;
      check(el, el.getBoundingClientRect(), `bar ${name(el)}`, false);
    }
    return out;
  });
}

/** Wait for the page to settle (fonts, entrances), then assert nothing is clipped and nothing overflows sideways. */
export async function expectNothingClipped(page: Page, where: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const clipped = await clippedContent(page);
  expect.soft(clipped, `${where}: content cut off`).toEqual([]);
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  expect.soft(sw, `${where}: horizontal page scroll`).toBeLessThanOrEqual(iw);
}
