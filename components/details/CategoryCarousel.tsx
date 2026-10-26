'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue, type PanInfo } from 'framer-motion';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { prevLabel, qLabel, type MainProblem } from '@/components/bento/MainProblemCard';
import { isTyping } from '@/components/shell/EscToParent';
import { categoryById } from '@/lib/categories';
import { href } from '@/lib/details';
import { pct } from '@/lib/format';
import { cardArrived, HANDOFF } from '@/lib/handoff';
import type { CategoryId } from '@/lib/types';

/** Gliding the active card into its slot: a critically damped spring (no overshoot) that keeps the release velocity, ~0.5 s. */
const SLIDE = { type: 'spring', stiffness: 260, damping: 34 } as const;
/** Share of the release velocity added to where the row lands (the momentum of a flick). */
const POWER = 0.25;
/**
 * Opacity by a card's distance (in card pitches) from the active slot at the left of the content column: the next card
 * clear, then fainter, gone by the fourth; a card slid out to the left fades within one pitch. Follows the row while it
 * is dragged or gliding, so the fade reads as one gradient anchored on the active card.
 */
const FADE_AT = [-1, 0, 1, 2, 3, 4];
const FADE_TO = [0, 1, 0.75, 0.45, 0.2, 0];
export function fadeAt(d: number): number {
  if (d <= FADE_AT[0]) return FADE_TO[0];
  for (let k = 1; k < FADE_AT.length; k++)
    if (d <= FADE_AT[k]) return FADE_TO[k - 1] + ((FADE_TO[k] - FADE_TO[k - 1]) * (d - FADE_AT[k - 1])) / (FADE_AT[k] - FADE_AT[k - 1]);
  return FADE_TO[FADE_TO.length - 1];
}

/**
 * The page (one per category) remounts this carousel on every category change. The outgoing one leaves where its row
 * stands relative to its target, so the incoming one continues that glide instead of jumping to the end of it.
 */
let carry: { cat: CategoryId; offset: number; velocity: number } | null = null;
/** A keyboard move: the incoming carousel focuses its active card. */
let refocus = false;

/**
 * The category page's compact cards: one same-size dark card per category, ranked by the latest quarter's gap (worst
 * first, so #1 is the dashboard's main problem). The active card is this page's category, anchored at the left edge of
 * the content column with an accent ring; the cards after it fade out with distance (fadeAt) and the row's edges are
 * masked. Drag or flick the row (it snaps to the nearest card),
 * click a card, or use ←/→ on it: the URL follows (filter kept) and the content below with it.
 * The active card is the landing point of the dashboard hand-off (lib/handoff). Reduced motion: no glide.
 */
export function CategoryCarousel({ cards, current, query }: { cards: MainProblem[]; current: CategoryId; query: string }) {
  const n = cards.length;
  const at = Math.max(0, cards.findIndex((c) => c.category === current));
  // The card the server render puts in the active slot (CSS offset below); x is the row's offset from there.
  const [origin] = useState(at);
  const [index, setIndex] = useState(at);
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const reduce = useReducedMotion();
  const router = useRouter();
  const x = useMotionValue(0);
  const row = useRef<HTMLDivElement>(null);
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const indexRef = useRef(index);
  indexRef.current = index;
  const stepRef = useRef(step);
  stepRef.current = step;
  const dragged = useRef(false);
  const url = useCallback((i: number) => href(`/category/${cards[i].category}`, query), [cards, query]);
  const target = useCallback((i: number) => (origin - i) * stepRef.current, [origin]);

  const slide = useCallback(
    (to: number) => {
      if (reduce) x.set(to);
      else animate(x, to, { ...SLIDE, velocity: x.getVelocity() });
    },
    [reduce, x],
  );

  // Mount: take over the outgoing row's glide, tell a waiting hand-off the card is here, keep a keyboard user's focus.
  useLayoutEffect(() => {
    const c = carry;
    carry = null;
    if (c && c.cat === cards[origin].category && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && Math.abs(c.offset) > 0.5) {
      x.set(c.offset);
      animate(x, 0, { ...SLIDE, velocity: c.velocity });
    }
    cardArrived();
    if (refocus) {
      refocus = false;
      links.current[origin]?.focus({ preventScroll: true });
    }
    return () => {
      const s = stepRef.current;
      carry = { cat: cards[indexRef.current].category, offset: x.get() - (origin - indexRef.current) * s, velocity: x.getVelocity() };
    };
  }, [cards, origin, x]);

  // Card pitch (card + gap), re-measured on resize; a resize puts the row straight on its target.
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const measure = () => {
      const [a, b] = Array.from(el.children) as HTMLElement[];
      const s = b ? b.offsetLeft - a.offsetLeft : a.offsetWidth;
      if (stepRef.current && s !== stepRef.current) {
        stepRef.current = s;
        x.set(target(indexRef.current));
      }
      stepRef.current = s;
      setStep(s);
    };
    measure();
    setReady(true);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [target, x]);

  // The route moved on (back/forward): show its card.
  useEffect(() => setIndex(at), [at]);

  // Glide the active card into the left slot whenever it changes.
  const shown = useRef(index);
  useEffect(() => {
    if (shown.current === index) return;
    shown.current = index;
    if (stepRef.current) slide(target(index));
  }, [index, slide, target]);

  useEffect(() => {
    for (const i of [index - 1, index + 1]) if (i >= 0 && i < n) router.prefetch(url(i));
  }, [index, n, router, url]);

  const go = (next: number, focus = false) => {
    if (next < 0 || next >= n) return;
    if (next === indexRef.current) {
      slide(target(next));
      return;
    }
    refocus = focus;
    if (focus) links.current[next]?.focus({ preventScroll: true });
    setIndex(next);
    router.push(url(next), { scroll: false });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(indexRef.current + 1, true); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(indexRef.current - 1, true); }
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const s = stepRef.current;
    if (!s) return;
    const landing = x.get() + info.velocity.x * POWER;
    go(Math.max(0, Math.min(n - 1, Math.round(origin - landing / s))), row.current?.contains(document.activeElement) ?? false);
  };

  const name = categoryById(cards[index].category).name;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Categories, worst gap first"
      data-testid="category-deck"
      data-index={index}
      data-ready={ready ? '' : undefined}
      className="pb-[clamp(14px,2.4svh,28px)]"
    >
      <h1 className="sr-only">{name}</h1>
      <p className="sr-only" aria-live="polite">{`${index + 1} of ${n}: ${name}`}</p>
      <div data-testid="category-carousel" className="carousel-fade overflow-x-clip py-[10px]">
        <motion.div
          ref={row}
          role="list"
          drag={n > 1 ? 'x' : false}
          dragConstraints={{ left: target(n - 1), right: target(0) }}
          dragElastic={0.16}
          dragMomentum={false}
          onPointerDownCapture={() => { dragged.current = false; }}
          onDragStart={() => { dragged.current = true; }}
          onDragEnd={onDragEnd}
          onClickCapture={(e) => {
            if (!dragged.current) return;
            e.preventDefault();
            e.stopPropagation();
          }}
          onKeyDown={onKeyDown}
          className="carousel-row flex w-max cursor-grab select-none gap-[var(--cc-gap)] active:cursor-grabbing"
          style={{ x, ['--origin' as string]: origin }}
        >
          {cards.map((c, i) => (
            <FadingItem key={c.category} x={x} offset={i - origin} step={stepRef}>
              <CompactCard
                ref={(el) => { links.current[i] = el; }}
                card={c}
                rank={i + 1}
                active={i === index}
                href={url(i)}
                onClick={(e) => {
                  if (i === indexRef.current) e.preventDefault();
                  else setIndex(i);
                }}
              />
            </FadingItem>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/** A list item whose opacity follows its live distance from the active slot (fadeAt); a card faded out takes no clicks. */
function FadingItem({ x, offset, step, children }: { x: MotionValue<number>; offset: number; step: React.RefObject<number>; children: React.ReactNode }) {
  const opacity = useTransform(x, (v) => fadeAt(offset + (step.current ? v / step.current : 0)));
  const pointerEvents = useTransform(opacity, (o) => (o < 0.05 ? 'none' : 'auto'));
  return (
    <motion.div role="listitem" className="shrink-0" style={{ opacity, pointerEvents }}>
      {children}
    </motion.div>
  );
}

/** One compact card: rank, category name, the gap %, Δ vs the previous quarter. The dashboard card's design, pared down. */
function CompactCard({
  card,
  rank,
  active,
  href: to,
  onClick,
  ref,
}: {
  card: MainProblem;
  rank: number;
  active: boolean;
  href: string;
  onClick: (e: React.MouseEvent) => void;
  ref: React.Ref<HTMLAnchorElement>;
}) {
  const name = categoryById(card.category).name;
  const d = card.prevGapRate === null ? null : Math.round(card.gapRate * 100) - Math.round(card.prevGapRate * 100);
  const vs = prevLabel(card.quarter);
  return (
    <Link
      ref={ref}
      href={to}
      scroll={false}
      draggable={false}
      onClick={onClick}
      tabIndex={active ? 0 : -1}
      aria-current={active ? 'page' : undefined}
      aria-label={`#${rank} ${name}, ${pct(card.gapRate)}% score lost`}
      data-testid="category-card"
      data-cat={card.category}
      data-rank={rank}
      data-active={active ? '' : undefined}
      title={`${name}: gap ${pct(card.gapRate)}% in ${qLabel(card.quarter)}`}
      className={`compact-card hero-tile flex h-[var(--cc-h)] w-[var(--cc-w)] flex-col justify-between rounded-[var(--radius-card)] p-[clamp(14px,1.1vw,20px)] transition-[box-shadow] duration-300 ${active ? 'is-active' : ''}`}
      style={active ? { viewTransitionName: HANDOFF } : undefined}
    >
      <span className="flex min-w-0 flex-col gap-1">
        <span className="num text-[13px] font-semibold" style={{ color: 'var(--hero-accent)' }}>{`#${rank}`}</span>
        <span className="line-clamp-2 text-[clamp(16px,1.15vw,21px)] font-semibold leading-[1.1] tracking-[-0.02em]">{name}</span>
      </span>
      <span className="flex items-end gap-[clamp(8px,0.7vw,12px)]">
        <span data-testid="category-card-gap" className="figure text-[clamp(44px,3.3vw,64px)]" style={{ color: 'var(--hero-accent)' }}>
          {pct(card.gapRate)}
          <span className="text-[0.42em] tracking-normal">%</span>
        </span>
        <span className="flex shrink-0 flex-col gap-0.5 whitespace-nowrap pb-[0.45em] text-[12px] min-[1600px]:text-[13px]">
          <span style={{ color: 'var(--hero-muted)' }}>gap</span>
          {d !== null && (
            <span
              className="num inline-flex items-center gap-0.5 font-semibold"
              style={{ color: d < 0 ? 'var(--hero-up)' : d > 0 ? 'var(--hero-down)' : 'var(--hero-muted)' }}
            >
              {d > 0 && <ArrowUp size={12} strokeWidth={2.6} aria-hidden />}
              {d < 0 && <ArrowDown size={12} strokeWidth={2.6} aria-hidden />}
              {d > 0 ? '+' : d < 0 ? '−' : '±'}
              {Math.abs(d)} {Math.abs(d) === 1 ? 'pt' : 'pts'}
              <span className="ml-1 font-normal" style={{ color: 'var(--hero-muted)' }}>vs {vs}</span>
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}
