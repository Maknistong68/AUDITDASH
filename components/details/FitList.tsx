'use client';
import { ChevronDown } from 'lucide-react';
import { Children, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Height kept for the "+M more" button when not every row fits. */
const MORE_H = 34;

/**
 * A ranked list in a one-screen view: shows the top rows that fit its box, then "+M more", which expands the list in
 * place inside the box (it scrolls inside, the page never does). Re-fits on resize. A `#id` in the URL that names a
 * hidden row opens the list on it.
 */
export function FitList({ children, testid, className = '', label }: {
  children: React.ReactNode;
  /** The button is `<testid>-more`. */
  testid: string;
  className?: string;
  /** What the rows are, for the button's accessible name ("+3 more contractors"). */
  label: string;
}) {
  const rows = Children.toArray(children);
  const n = rows.length;
  const wrap = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const [fit, setFit] = useState(n);
  const [open, setOpen] = useState(false);

  // Measured only while every row is rendered: the box is then as tall as the screen lets it be. Hiding rows shrinks the
  // box (the cards size to their content), so measuring again then would cut further; a window resize starts over.
  const measure = useCallback(() => {
    const box = wrap.current;
    const ol = list.current;
    if (!box || !ol || !ol.children.length) return;
    // The box never scrolls itself (a #hash on load may have scrolled it): only the opened list does.
    box.scrollTop = 0;
    const bottom = box.getBoundingClientRect().bottom;
    const ends = [...ol.children].map((li) => li.getBoundingClientRect().bottom);
    if (ends[ends.length - 1] <= bottom + 0.5) return;
    setFit(Math.max(1, ends.filter((e) => e <= bottom - MORE_H + 0.5).length));
  }, []);

  useLayoutEffect(() => {
    if (fit === n && !open) measure();
  }, [fit, n, open, measure]);

  useEffect(() => {
    const again = () => setFit(n);
    window.addEventListener('resize', again);
    document.fonts?.ready.then(again);
    return () => window.removeEventListener('resize', again);
  }, [n]);

  // A deep link to a row the box hides: open the list there.
  useLayoutEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    const target = id ? document.getElementById(id) : null;
    const li = target?.closest<HTMLElement>('[data-rank]');
    const box = wrap.current;
    if (!target || !li || !box || !list.current?.contains(li)) return;
    if (li.getBoundingClientRect().bottom <= box.getBoundingClientRect().bottom - MORE_H) return;
    setOpen(true);
    requestAnimationFrame(() => target.scrollIntoView({ block: 'nearest' }));
  }, []);

  const shown = open ? n : fit;
  const hidden = n - fit;
  return (
    <div ref={wrap} className="flex min-h-0 flex-auto flex-col overflow-hidden">
      <ol
        ref={list}
        data-testid={testid}
        data-open={open ? '' : undefined}
        className={`min-h-0 flex-auto ${open ? 'overflow-y-auto overscroll-contain' : 'overflow-hidden'} ${className}`}
      >
        {rows.map((r, i) => (
          <li key={i} hidden={i >= shown} data-rank={i}>
            {r}
          </li>
        ))}
      </ol>
      {hidden > 0 && (
        <button
          type="button"
          data-testid={`${testid}-more`}
          aria-expanded={open}
          aria-label={open ? `Show fewer ${label}` : `Show ${hidden} more ${label}`}
          onClick={() => setOpen((o) => !o)}
          className="mt-1 inline-flex h-[30px] w-fit shrink-0 items-center gap-1 self-start rounded-full px-2.5 text-[13px] font-semibold text-[var(--accent)] transition-colors hover:bg-fill-2"
        >
          {open ? 'Show fewer' : `+${hidden} more`}
          <ChevronDown size={14} strokeWidth={2.6} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
      )}
    </div>
  );
}
