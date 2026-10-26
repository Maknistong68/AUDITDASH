/**
 * The "card opens" hand-off, shared by every clickable dashboard card: one shared-element view transition.
 * Inside the clicked card, every element marked `data-handoff="<name>"` (the card itself included) takes that
 * `view-transition-name` only for the moment of the click; the detail view's header element carries the same name
 * as its `view-transition-name`, so the browser morphs one into the other (position and size). Timing is the ::view-transition
 * rules in globals.css: HANDOFF_MS, ease-out. Unsupported browsers and reduced motion get a plain navigation.
 */

import type { MouseEvent } from 'react';

/** Main problem card → the category page's active carousel card. */
export const HANDOFF = 'mp-card';
/** Repeat findings card → the /repeats header strip, and its figure → the header figure. */
export const REPEATS_CARD = 'rp-card';
export const REPEATS_FIGURE = 'rp-figure';
/** High-risk work card → the /high-risk header strip, and its figure → the header figure. */
export const HIGHRISK_CARD = 'hr-card';
export const HIGHRISK_FIGURE = 'hr-figure';
/** Portfolio score card → the /audits header strip, and its figure → the header figure; the Bands and Region cards → their panels. */
export const PORTFOLIO_CARD = 'ps-card';
export const PORTFOLIO_FIGURE = 'ps-figure';
export const BANDS_CARD = 'ps-bands';
export const REGIONS_CARD = 'ps-regions';

/** Length of the morph (mirrors `::view-transition-group(*)` in globals.css). */
export const HANDOFF_MS = 1000;
/** Ease-out (mirrors globals.css); also the carousel glide's curve. */
export const HANDOFF_EASE = [0.22, 1, 0.36, 1] as const;

let arrived: (() => void) | null = null;

/** Called by a detail view once its landing element is in the DOM: the browser may capture the new state. */
export function cardArrived() {
  arrived?.();
}

export function canHandOff(): boolean {
  return (
    typeof document !== 'undefined' &&
    typeof document.startViewTransition === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** The elements of `card` (itself included) that take part, with their names from `data-handoff`. */
export function handoffParts(card: HTMLElement): [HTMLElement, string][] {
  const els = [card, ...card.querySelectorAll<HTMLElement>('[data-handoff]')].filter((e) => e.dataset.handoff);
  return els.map((e) => [e, e.dataset.handoff!]);
}

/**
 * Run `navigate` inside a view transition from `from` (one element, named HANDOFF, or a list of [element, name]) to the
 * next page's matching elements (gives up waiting for cardArrived after 3 s).
 */
export function handOff(from: HTMLElement | [HTMLElement, string][], navigate: () => void) {
  const parts: [HTMLElement, string][] = Array.isArray(from) ? from : [[from, HANDOFF]];
  for (const [el, name] of parts) el.style.viewTransitionName = name;
  const t = document.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(timer);
          arrived = null;
          resolve();
        };
        const timer = setTimeout(done, 3000);
        arrived = done;
        navigate();
      }),
  );
  t.finished.finally(() => {
    for (const [el] of parts) el.style.removeProperty('view-transition-name');
  });
}

/** True when a click should open in place (plain left click, nothing handled it already). */
export function isPlainClick(e: MouseEvent): boolean {
  return !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}
