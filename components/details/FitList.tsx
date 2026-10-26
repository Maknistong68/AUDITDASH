'use client';
import { ChevronDown } from 'lucide-react';
import { Children, useCallback, useLayoutEffect, useRef, useState } from 'react';

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

  const measure = useCallback(() => {
    const box = wrap.current;
    const ol = list.current;
    const first = ol?.firstElementChild as HTMLElement | null;
    if (!box || !ol || !first) return;
    // The box never scrolls itself (a #hash on load may have scrolled it): only the opened list does.
    box.scrollTop = 0;
    const avail = box.clientHeight;
    const row = first.offsetHeight;
    const gap = parseFloat(getComputedStyle(ol).rowGap) || 0;
    if (!row) return;
    if (n * row + (n - 1) * gap <= avail + 0.5) setFit(n);
    else setFit(Math.max(1, Math.floor((avail - MORE_H + gap) / (row + gap))));
  }, [n]);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (wrap.current) ro.observe(wrap.current);
    // A deep link to a row the box hides: open the list there.
    const id = decodeURIComponent(window.location.hash.slice(1));
    const target = id ? document.getElementById(id) : null;
    const li = target?.closest<HTMLElement>('[data-rank]');
    if (target && li && list.current?.contains(li) && Number(li.dataset.rank) >= fitNow(list.current, wrap.current)) {
      setOpen(true);
      requestAnimationFrame(() => target.scrollIntoView({ block: 'nearest' }));
    }
    return () => ro.disconnect();
  }, [measure]);

  const shown = open ? n : fit;
  const hidden = n - fit;
  return (
    <div ref={wrap} className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ol
        ref={list}
        data-testid={testid}
        data-open={open ? '' : undefined}
        className={`min-h-0 ${open ? 'flex-1 overflow-y-auto overscroll-contain' : 'shrink-0'} ${className}`}
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

/** Rows that fit before the first measure has been applied (for the deep-link check on mount). */
function fitNow(ol: HTMLOListElement, box: HTMLDivElement | null): number {
  const first = ol.firstElementChild as HTMLElement | null;
  if (!first || !box) return Infinity;
  const gap = parseFloat(getComputedStyle(ol).rowGap) || 0;
  const n = ol.children.length;
  const row = first.offsetHeight;
  if (!row || n * row + (n - 1) * gap <= box.clientHeight + 0.5) return Infinity;
  return Math.floor((box.clientHeight - MORE_H + gap) / (row + gap));
}
