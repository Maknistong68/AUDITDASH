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
/** Positive observations card → the /positives header strip, and its figure → the header figure. */
export const POSITIVES_CARD = 'po-card';
export const POSITIVES_FIGURE = 'po-figure';
/** A Contractors card row → the contractor page: its name → the page title, its score → the opened audit's score. */
export const CONTRACTOR_NAME = 'ct-name';
export const CONTRACTOR_SCORE = 'ct-score';
/**
 * Drill-downs below a category, the same card-opens morph as the dashboard cards: the clicked row grows into the next
 * page's first card. One name per level, so a page that is itself a landing (named card) can start the next drill.
 */
export const DRILL_CONTRACTOR = 'dl-contractor'; // category page contractor row → contractor in the category
export const DRILL_ITEM = 'dl-item'; // that page's question row → the question page
export const DRILL_NOTE = 'dl-note'; // the question page's history entry → the note page

/**
 * Length of the morph, in ms (mirrors `::view-transition-group(*)` in globals.css, with its ease-out
 * cubic-bezier(0.22, 1, 0.36, 1)); the category carousel's glide is tuned to about the same length.
 */
export const HANDOFF_MS = 1500;

let arrived: (() => void) | null = null;

/** Called by a detail view once its landing element is in the DOM: the browser may capture the new state. */
export function cardArrived() {
  arrived?.();
}

/** True while a hand-off waits for its landing: a landing card then skips its own rise (the morph is its entrance). */
export function handoffPending(): boolean {
  return arrived !== null;
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
