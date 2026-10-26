'use client';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ProblemCardContent, type MainProblem } from '@/components/bento/MainProblemCard';
import { NavButton } from '@/components/motion/AuditCarousel';
import { isTyping } from '@/components/shell/EscToParent';
import { categoryById } from '@/lib/categories';
import { snapIndex } from '@/lib/carousel';
import { href } from '@/lib/details';
import type { CategoryId } from '@/lib/types';

/** Share of the card width a drag must pass to change category (a fast flick also does). */
const THRESHOLD = 0.25;
const ENTER = { type: 'spring', stiffness: 380, damping: 36, mass: 0.9 } as const;
const EXIT = { duration: 0.2, ease: [0.4, 0, 1, 1] } as const;
type Swap = { dir: number; w: number };
const variants = {
  enter: ({ dir, w }: Swap) => ({ x: dir * w * 0.6, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: ENTER },
  exit: ({ dir, w }: Swap) => ({ x: -dir * w * 0.6, opacity: 0, transition: EXIT }),
};
/** Set before a keyboard/drag navigation so the deck mounted by the next page takes focus back. */
let refocus = false;
/** Set when this deck navigates: the next page's deck shows its figure at once instead of counting up again. */
let arriving = false;

/**
 * The category page's card: the dashboard's Main problem card (same design) for the page's category, labelled with
 * its rank ("#1 · Q1 2026"); categories are ranked by the latest quarter's gap, worst first, so #1 is the main problem.
 * Drag/flick the card (or ←/→ while it has focus, or Previous/Next category) to move to the neighbouring rank: the
 * card slides out in the drag direction, the next one slides in from the other side, then the URL follows (filter kept).
 * Under reduced motion it navigates at once, with no slide.
 */
export function CategoryCardDeck({ cards, audits, current, query }: { cards: MainProblem[]; audits: number; current: CategoryId; query: string }) {
  const n = cards.length;
  const at = Math.max(0, cards.findIndex((c) => c.category === current));
  const [index, setIndex] = useState(at);
  const [dir, setDir] = useState(1);
  const [ready, setReady] = useState(false);
  // Count the gap up only on a fresh visit; a card swapped in (and its page after the URL change) shows it at once.
  const [countUp, setCountUp] = useState(() => !arriving);
  const reduce = useReducedMotion();
  const router = useRouter();
  const frame = useRef<HTMLDivElement>(null);
  const indexRef = useRef(index);
  indexRef.current = index;
  const pending = useRef<string | null>(null);
  const width = useRef(0);
  const url = useCallback((i: number) => href(`/category/${cards[i].category}`, query), [cards, query]);

  // The route moved on (navigation done, back/forward): show its card.
  useEffect(() => {
    setIndex(at);
  }, [at]);

  useEffect(() => {
    setReady(true);
    arriving = false;
    if (refocus) {
      refocus = false;
      frame.current?.focus({ preventScroll: true });
    }
  }, []);

  useEffect(() => {
    for (const i of [index - 1, index + 1]) if (i >= 0 && i < n) router.prefetch(url(i));
  }, [index, n, router, url]);

  const go = useCallback(
    (next: number, keepFocus = false) => {
      if (next < 0 || next >= n || next === indexRef.current) return;
      width.current = frame.current?.offsetWidth ?? 0;
      refocus = keepFocus;
      arriving = true;
      setCountUp(false);
      setDir(next > indexRef.current ? 1 : -1);
      setIndex(next);
      if (reduce) router.push(url(next), { scroll: false });
      else pending.current = url(next);
    },
    [n, reduce, router, url],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(indexRef.current + 1, true); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(indexRef.current - 1, true); }
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const w = frame.current?.offsetWidth ?? 0;
    // Below the threshold (or past either end) the elastic constraints spring it back.
    go(snapIndex(indexRef.current, n, info.offset.x, info.velocity.x, w, THRESHOLD), frame.current === document.activeElement);
  };

  const card = cards[index];
  const name = categoryById(card.category).name;
  const elastic = 0.6;
  const edge = 0.12;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Categories, worst gap first"
      data-testid="category-deck"
      data-index={index}
      data-ready={ready ? '' : undefined}
      className="overflow-x-clip px-[var(--gutter)] pb-[clamp(14px,2.4svh,28px)] pt-1"
    >
      <p className="sr-only" aria-live="polite">{`${index + 1} of ${n}: ${name}`}</p>
      <div className="flex flex-wrap items-end gap-x-[clamp(16px,1.6vw,28px)] gap-y-3">
        <div
          ref={frame}
          tabIndex={0}
          data-testid="category-card"
          data-cat={card.category}
          data-rank={index + 1}
          aria-label={`#${index + 1} of ${n}: ${name}. Use the left and right arrow keys or drag to change category`}
          onKeyDown={onKeyDown}
          className="relative flex w-full rounded-[var(--radius-card)] min-[1200px]:h-[calc((100svh_-_var(--topbar)_-_clamp(6px,1.2svh,16px)_-_clamp(14px,2.4svh,32px)_-_2_*_var(--gap-grid))_*_1.38_/_3.38)] min-[1200px]:w-[calc((100%_-_var(--gap-grid))_/_2.18)]"
        >
          <AnimatePresence mode="wait" initial={false} custom={{ dir, w: width.current }}>
            <motion.article
              key={card.category}
              custom={{ dir, w: width.current }}
              variants={variants}
              initial={reduce ? false : 'enter'}
              animate="center"
              exit={reduce ? undefined : 'exit'}
              onAnimationComplete={(def) => {
                if (def !== 'center' || !pending.current) return;
                const to = pending.current;
                pending.current = null;
                router.push(to, { scroll: false });
              }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: index < n - 1 ? elastic : edge, right: index > 0 ? elastic : edge }}
              dragMomentum={false}
              onDragEnd={onDragEnd}
              aria-labelledby="category-card-title"
              className="hero-tile relative flex min-h-0 w-full min-w-0 cursor-grab select-none rounded-[var(--radius-card)] active:cursor-grabbing"
            >
              <ProblemCardContent problem={card} audits={audits} label={`#${index + 1}`} headingId="category-card-title" as="h1" countUp={countUp} />
            </motion.article>
          </AnimatePresence>
        </div>
        {n > 1 && (
          <div className="flex items-center gap-3 print:hidden">
            <div className="flex items-center gap-2 text-[13px] text-muted">
              <span className="num" data-testid="category-position">{`${index + 1} / ${n}`}</span>
              <span aria-hidden className="flex items-center gap-1">
                {cards.map((c, i) => (
                  <span
                    key={c.category}
                    className={`block h-[7px] rounded-full transition-[width,background-color] duration-300 ${i === index ? 'w-5 bg-ink' : 'w-[7px] bg-[var(--control)]'}`}
                  />
                ))}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <NavButton label="Previous category" hint="Worse gap (←)" disabled={index === 0} onClick={() => go(index - 1)}>
                <ChevronLeft size={18} strokeWidth={2.4} aria-hidden />
              </NavButton>
              <NavButton label="Next category" hint="Smaller gap (→)" disabled={index === n - 1} onClick={() => go(index + 1)}>
                <ChevronRight size={18} strokeWidth={2.4} aria-hidden />
              </NavButton>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
