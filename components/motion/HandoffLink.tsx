'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLayoutEffect } from 'react';
import { canHandOff, cardArrived, handoffParts, handOff, isPlainClick } from '@/lib/handoff';

/**
 * The whole-card link of a dashboard card that opens a detail view with the shared hand-off (lib/handoff). It covers its
 * card (the nearest `[data-handoff-card]` ancestor: a BentoCard with `handoff`, the main problem tile, a contractor row);
 * on a plain click the card's `data-handoff`
 * elements morph into the detail view's elements of the same names. Link prefetches the view, so the morph starts
 * without a wait. Modified clicks, reduced motion and browsers without view transitions navigate as a normal link.
 */
export function HandoffLink({ href, className, ...rest }: { href: string; className?: string } & Omit<React.ComponentProps<typeof Link>, 'href' | 'onClick'>) {
  const router = useRouter();
  return (
    <Link
      href={href}
      onClick={(e) => {
        const card = e.currentTarget.closest<HTMLElement>('[data-handoff-card]');
        if (!isPlainClick(e) || !card || !canHandOff()) return;
        e.preventDefault();
        handOff(handoffParts(card), () => router.push(href));
      }}
      className={className}
      {...rest}
    />
  );
}

/** Placed in a detail view: tells a waiting hand-off that the landing elements are in the DOM. */
export function HandoffLanding() {
  useLayoutEffect(() => cardArrived(), []);
  return null;
}
