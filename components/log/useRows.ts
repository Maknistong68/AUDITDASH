'use client';
import { useEffect, useRef, useState } from 'react';
import { QUICK, RISE, STAGGER, calm } from '@/lib/motion';

/** Rows shown per page; more arrive as the list end scrolls into view (or on "Show more"). */
export const PAGE = 60;
/** Only the first rows stagger on arrival, so a long list never takes long to settle. */
const STAGGERED = 12;

/**
 * Motion props of a list row. On the page's first paint rows rise in on the house curve (1.5 s, small stagger capped at
 * the first 12); rows that arrive later (a filter change, the next page) fade in on the short QUICK curve. Positions
 * shift on QUICK too (framer `layout`).
 */
export function useRowMotion() {
  const first = useRef(true);
  useEffect(() => {
    const t = window.setTimeout(() => { first.current = false; }, 50);
    return () => window.clearTimeout(t);
  }, []);
  return (i: number) =>
    first.current
      ? {
          initial: RISE.initial,
          animate: RISE.animate,
          exit: { opacity: 0, transition: QUICK },
          transition: { ...calm(0.1 + Math.min(i, STAGGERED) * STAGGER), layout: QUICK },
        }
      : {
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
          exit: { opacity: 0, transition: QUICK },
          transition: { ...QUICK, layout: QUICK },
        };
}

/**
 * How many rows to render: PAGE, growing by PAGE whenever the sentinel (returned ref) nears the viewport. Resets to PAGE
 * when `resetKey` changes (a new search or filter).
 */
export function usePaged(total: number, resetKey: string) {
  const [state, setState] = useState({ key: resetKey, n: PAGE });
  const n = state.key === resetKey ? state.n : PAGE;
  if (state.key !== resetKey) setState({ key: resetKey, n: PAGE });
  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || n >= total) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setState((s) => ({ key: s.key, n: s.n + PAGE }));
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [n, total]);
  return { shown: Math.min(n, total), more: () => setState((s) => ({ key: s.key, n: s.n + PAGE })), sentinel };
}
