'use client';
import { useEffect } from 'react';

/**
 * Publishes the top bar's measured height as `--topbar-h` on <html>, so one-screen views size from what the bar really
 * takes (it wraps below 1200px) instead of the nominal `--topbar`. Renders nothing.
 */
export function TopBarHeight() {
  useEffect(() => {
    const bar = document.querySelector<HTMLElement>('[data-testid="topbar"]');
    if (!bar) return;
    const root = document.documentElement;
    const set = () => root.style.setProperty('--topbar-h', `${bar.getBoundingClientRect().height}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(bar);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--topbar-h');
    };
  }, []);
  return null;
}
