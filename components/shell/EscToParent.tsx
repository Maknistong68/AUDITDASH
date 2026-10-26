'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** True when a key press belongs to a text field (or a select / editable element), not to page navigation. */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
}

/** Esc goes one level up the drill (ignored while typing or when something else handled the key). */
export function EscToParent({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    router.prefetch(href);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      router.push(href);
    };
    window.addEventListener('keydown', onKey);
    document.body.setAttribute('data-esc-ready', ''); // listener is live (used by e2e)
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.removeAttribute('data-esc-ready');
    };
  }, [href, router]);
  return null;
}
