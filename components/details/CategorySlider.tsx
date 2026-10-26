'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { animate, motion, useMotionValue, useReducedMotion, type PanInfo } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GAP_TILE_CLASS, GapTileBody, gapTileLabel, rankGaps, type GapRow } from '@/components/charts/GapRadar';
import { isTyping } from '@/components/shell/EscToParent';
import { categoryById } from '@/lib/categories';
import { snapIndex } from '@/lib/carousel';
import { href } from '@/lib/details';
import type { CategoryId } from '@/lib/types';

const SNAP = { type: 'spring', stiffness: 320, damping: 36, mass: 0.9 } as const;
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
/** Edges of the track fade out, so the neighbours dissolve towards the sides. */
const FADE = 'linear-gradient(to right, transparent 0, #000 22%, #000 78%, transparent 100%)';

/**
 * The categories as a slider under the category page's header, in "Where it fails" order (worst gap first).
 * The page's category sits centred and fully opaque; its neighbours shrink, dim and fade towards the edges.
 * Drag/swipe, "Previous/Next category" or ←/→ (while focus is in the slider, so the quarter carousel below keeps
 * its own arrows) select a category: the track re-centres on it, then the page navigates to it with the filter kept.
 */
export function CategorySlider({ gaps, current, query }: { gaps: GapRow[]; current: CategoryId; query: string }) {
  const ranked = rankGaps(gaps);
  const n = ranked.length;
  const at = Math.max(0, ranked.findIndex((g) => g.category === current));
  const [index, setIndex] = useState(at);
  const [measured, setMeasured] = useState(false);
  const reduce = useReducedMotion();
  const router = useRouter();
  const x = useMotionValue(0);
  const track = useRef<HTMLOListElement>(null);
  const step = useRef(0);
  const dragged = useRef(false);
  const indexRef = useRef(index);
  indexRef.current = index;

  /** Distance between two card starts (card width + gap), in px. */
  const measure = useCallback(() => {
    const kids = track.current?.children;
    if (!kids || kids.length < 2) return step.current;
    step.current = (kids[1] as HTMLElement).offsetLeft - (kids[0] as HTMLElement).offsetLeft;
    return step.current;
  }, []);

  // Take over from the CSS translate (right on the server render) with a px motion value.
  useIsoLayoutEffect(() => {
    measure();
    x.jump(-indexRef.current * step.current);
    setMeasured(true);
    const ro = new ResizeObserver(() => {
      measure();
      x.jump(-indexRef.current * step.current);
    });
    if (track.current) ro.observe(track.current);
    return () => ro.disconnect();
  }, []);

  // The route moved on (e.g. back/forward) while this slider stayed mounted: follow it.
  useEffect(() => {
    setIndex(at);
    const target = -at * (step.current || measure());
    if (reduce) x.jump(target);
    else animate(x, target, SNAP);
  }, [at]); // eslint-disable-line react-hooks/exhaustive-deps

  const select = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(n - 1, i));
      const target = -next * (step.current || measure());
      const url = href(`/category/${ranked[next].category}`, query);
      if (next === indexRef.current) {
        if (reduce) x.jump(target);
        else animate(x, target, SNAP);
        return;
      }
      setIndex(next);
      router.prefetch(url);
      if (reduce) {
        x.jump(target);
        router.push(url, { scroll: false });
      } else {
        // Re-centre first, then hand over to the new page (which mounts already centred there).
        animate(x, target, SNAP).then(() => router.push(url, { scroll: false }));
      }
    },
    [n, ranked, query, reduce, router, x, measure],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); select(indexRef.current + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); select(indexRef.current - 1); }
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    select(snapIndex(indexRef.current, n, info.offset.x, info.velocity.x, step.current));
    window.setTimeout(() => { dragged.current = false; }, 0);
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Categories, worst gap first"
      data-testid="category-slider"
      data-index={index}
      data-ready={measured ? '' : undefined}
      onKeyDown={onKeyDown}
      className="relative pb-[clamp(10px,1.8svh,22px)] print:hidden"
    >
      <p className="sr-only" aria-live="polite">{`${index + 1} of ${n}: ${categoryById(ranked[index].category).name}`}</p>
      <div className="overflow-x-clip py-2" style={{ maskImage: FADE, WebkitMaskImage: FADE }}>
        <motion.ol
          ref={track}
          drag="x"
          dragConstraints={{ left: -(n - 1) * (step.current || 0), right: 0 }}
          dragElastic={0.14}
          dragMomentum={false}
          onDragStart={() => { dragged.current = true; }}
          onDragEnd={onDragEnd}
          onClickCapture={(e) => {
            if (dragged.current) { e.preventDefault(); e.stopPropagation(); }
          }}
          style={{
            x,
            // Before hydration (and without JS) the page's category is centred by CSS alone.
            translate: measured ? undefined : `calc(-${index} * (var(--slide-w) + var(--gap-grid)))`,
            paddingLeft: 'calc(50% - var(--slide-w) / 2)',
          }}
          className="flex cursor-grab items-stretch gap-[var(--gap-grid)] [--slide-w:clamp(236px,20vw,380px)] active:cursor-grabbing"
        >
          {ranked.map((g, i) => {
            const active = i === index;
            return (
              <li
                key={g.category}
                className="flex w-[var(--slide-w)] shrink-0 transition-[opacity,scale] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                style={{ opacity: active ? 1 : 0.5, scale: active ? 1 : 0.9 }}
              >
                <Link
                  href={href(`/category/${g.category}`, query)}
                  scroll={false}
                  draggable={false}
                  data-testid="gap-tile"
                  data-cat={g.category}
                  data-gap={g.gapRate !== null && Number.isFinite(g.gapRate) ? g.gapRate : -1}
                  data-active={active ? '' : undefined}
                  aria-current={g.category === current ? 'page' : undefined}
                  aria-label={gapTileLabel(g, i + 1)}
                  onClick={(e) => {
                    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                    e.preventDefault();
                    select(i);
                  }}
                  className={GAP_TILE_CLASS}
                >
                  <GapTileBody g={g} rank={i + 1} />
                </Link>
              </li>
            );
          })}
        </motion.ol>
      </div>
      <div className="pointer-events-none absolute inset-x-[var(--gutter)] bottom-[clamp(10px,1.8svh,22px)] top-0 flex items-center justify-between">
        <NavButton label="Previous category" hint="Worse gap (←)" disabled={index === 0} onClick={() => select(index - 1)}>
          <ChevronLeft size={18} strokeWidth={2.4} aria-hidden />
        </NavButton>
        <NavButton label="Next category" hint="Smaller gap (→)" disabled={index === n - 1} onClick={() => select(index + 1)}>
          <ChevronRight size={18} strokeWidth={2.4} aria-hidden />
        </NavButton>
      </div>
    </section>
  );
}

function NavButton({ label, hint, disabled, onClick, children }: { label: string; hint: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={hint}
      disabled={disabled}
      onClick={onClick}
      className="pointer-events-auto grid size-9 place-items-center rounded-full bg-surface text-ink shadow-[var(--shadow-card)] transition-[transform,opacity,background-color] duration-200 enabled:hover:bg-surface-2 enabled:active:scale-90 disabled:cursor-default disabled:opacity-35"
    >
      {children}
    </button>
  );
}
