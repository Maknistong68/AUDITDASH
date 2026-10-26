/**
 * Animated hand-off between two routes with the View Transitions API: the source element (the Main Problem card)
 * morphs into the element carrying `data-handoff-target` on the next page (the category header tile).
 *
 * `view-transition-name`s are put on the source only for the transition (so nothing else on the dashboard is
 * named); the target names itself in CSS (`[data-handoff-target]`). The update callback pushes the route and
 * resolves once the target is in the DOM and the source is gone (a name must be unique in each snapshot),
 * or after a timeout so a slow page never freezes the screen.
 * Fallback: no API, reduced motion, or no source element -> a plain router.push (instant).
 */
type VT = { finished: Promise<void> };
type DocVT = Document & { startViewTransition?: (cb: () => Promise<void> | void) => VT };

const TIMEOUT_MS = 2500;

function waitFor(ready: () => boolean, timeout = TIMEOUT_MS): Promise<void> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    // setTimeout, not requestAnimationFrame: rendering (and rAF) is paused while a view transition's update runs.
    const tick = () => (ready() || performance.now() - t0 > timeout ? resolve() : setTimeout(tick, 16));
    tick();
  });
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/** Elements to name on the source, as [element, view-transition-name]. */
export type Named = [HTMLElement | null | undefined, string][];

export function handoff(push: (url: string) => void, url: string, named: Named): void {
  const doc = document as DocVT;
  const els = named.filter((n): n is [HTMLElement, string] => !!n[0]);
  if (!doc.startViewTransition || prefersReducedMotion() || !els.length) {
    push(url);
    return;
  }
  for (const [el, name] of els) el.style.setProperty('view-transition-name', name);
  const source = els[0][0];
  document.documentElement.dataset.handoff = '';
  const vt = doc.startViewTransition(() => {
    push(url);
    return waitFor(() => !source.isConnected && !!document.querySelector('[data-handoff-target]'));
  });
  vt.finished.finally(() => {
    for (const [el] of els) el.style.removeProperty('view-transition-name');
    delete document.documentElement.dataset.handoff;
  });
}
