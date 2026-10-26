/**
 * The dashboard → category hand-off: one shared-element view transition. The dashboard's Main problem card is named
 * `HANDOFF` only for the moment of the click; the category page's active carousel card carries the same name, so the
 * browser morphs one into the other (position and size), timed by the ::view-transition rules in globals.css.
 * Unsupported browsers and reduced motion get a plain navigation.
 */
export const HANDOFF = 'mp-card';

let arrived: (() => void) | null = null;

/** Called by the category carousel once its active card is in the DOM: the browser may capture the new state. */
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

/** Run `navigate` inside a view transition from `from` to the next page's card (gives up waiting after 3 s). */
export function handOff(from: HTMLElement, navigate: () => void) {
  from.style.viewTransitionName = HANDOFF;
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
  t.finished.finally(() => from.style.removeProperty('view-transition-name'));
}
