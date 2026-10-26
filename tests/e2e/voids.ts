import type { Locator } from '@playwright/test';

/**
 * The largest empty vertical band inside each card under `scope` (`section.card`): the union of the vertical extents of
 * every visible block (an element with its own text, a filled background or no child elements: text, bars, chips,
 * icons) is taken over the card's content box (padding excluded), and the longest stretch no block covers is the
 * card's void, in px. Plain containers are ignored, so a list stretched over the card does not hide its row gaps.
 */
export async function cardVoids(scope: Locator): Promise<{ card: string; void: number }[]> {
  return scope.locator('section.card').evaluateAll((cards) =>
    cards.map((card) => {
      const cs = getComputedStyle(card);
      const r = card.getBoundingClientRect();
      const top = r.top + parseFloat(cs.paddingTop) + parseFloat(cs.borderTopWidth);
      const bottom = r.bottom - parseFloat(cs.paddingBottom) - parseFloat(cs.borderBottomWidth);
      const spans: [number, number][] = [];
      for (const el of card.querySelectorAll<Element>('*')) {
        const text = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
        const s = getComputedStyle(el);
        const filled = !/^(transparent|rgba\(.*,\s*0\))$/.test(s.backgroundColor);
        const leaf = el.children.length === 0 || text || filled || el instanceof SVGSVGElement;
        if (!leaf || (el.closest('svg') !== el && el.closest('svg'))) continue;
        const b = el.getBoundingClientRect();
        if (b.width < 1 || b.height < 1) continue;
        if (s.visibility === 'hidden' || s.display === 'none') continue;
        const a = Math.max(top, b.top);
        const z = Math.min(bottom, b.bottom);
        if (z > a) spans.push([a, z]);
      }
      spans.sort((x, y) => x[0] - y[0]);
      let at = top;
      let worst = 0;
      for (const [a, z] of spans) {
        if (a > at) worst = Math.max(worst, a - at);
        at = Math.max(at, z);
      }
      worst = Math.max(worst, bottom - at);
      return { card: card.getAttribute('data-testid') ?? '?', void: Math.round(worst) };
    }),
  );
}
