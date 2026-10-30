'use client';
import { animate, motion, useMotionValue, useReducedMotion, type PanInfo } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { isTyping } from '@/components/shell/EscToParent';
import { snapIndex, withSlide } from '@/lib/carousel';
import { ScoreTrend, type ScoreTrendPoint } from '@/components/charts/ScoreTrend';

const SNAP = { type: 'spring', stiffness: 320, damping: 36, mass: 0.9 } as const;
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Swipeable history. Slide 0 is the latest; later slides are earlier in time and sit to the right, so a
 * swipe/drag to the left, → or "Previous …" goes back in time. The active slide lines up with the page
 * gutters and the neighbours peek into them. The index lives in `?s=` (replaced in place, other params kept).
 *
 * Generic over its slides: they are server-rendered nodes; `labels` name them for the dots and screen readers.
 */
export function AuditCarousel({
  slides,
  labels,
  initial = 0,
  unit = 'audit',
  title,
  fit = false,
  trend,
}: {
  slides: React.ReactNode[];
  labels: string[];
  initial?: number;
  unit?: 'audit' | 'quarter';
  title?: React.ReactNode;
  /** One-screen view (DetailFrame `fit`): the carousel fills what is left of the column and every slide is that tall. */
  fit?: boolean;
  /**
   * The audits' scores in DATE ORDER (one per slide, so slide i is point n − 1 − i): drawn as a score chart beside the
   * title, in the 8 columns over the slides' second and third cards. Its active point follows the slide; a click opens it.
   */
  trend?: ScoreTrendPoint[];
}) {
  const n = slides.length;
  const [index, setIndex] = useState(() => Math.max(0, Math.min(n - 1, initial)));
  const [measured, setMeasured] = useState(false);
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const track = useRef<HTMLDivElement>(null);
  const step = useRef(0);
  const dragged = useRef(false);
  const first = useRef(true);
  const indexRef = useRef(index);

  /** Distance between two slide starts (slide width + gap), in px. */
  const measure = useCallback(() => {
    const el = track.current;
    const kids = el?.children;
    if (!el || !kids || !kids.length) return 0;
    const a = kids[0] as HTMLElement;
    step.current = kids.length > 1 ? (kids[1] as HTMLElement).offsetLeft - a.offsetLeft : a.offsetWidth;
    return step.current;
  }, []);

  // Take over from the CSS translate (correct on the server render) with a px motion value.
  useIsoLayoutEffect(() => {
    measure();
    x.jump(-index * step.current);
    setMeasured(true);
    const ro = new ResizeObserver(() => {
      measure();
      x.jump(-indexRef.current * step.current);
    });
    if (track.current) ro.observe(track.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    indexRef.current = index;
    if (first.current) {
      first.current = false;
      return;
    }
    const target = -index * (step.current || measure());
    if (reduce) x.jump(target);
    else animate(x, target, SNAP);
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${withSlide(window.location.search, index)}${window.location.hash}`);
  }, [index, reduce, x, measure]);

  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(n - 1, i))), [n]);

  useEffect(() => {
    if (n < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(indexRef.current + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(indexRef.current - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [n, go]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const next = snapIndex(indexRef.current, n, info.offset.x, info.velocity.x, step.current);
    if (next === indexRef.current) {
      if (reduce) x.jump(-next * step.current);
      else animate(x, -next * step.current, SNAP);
    } else go(next);
    window.setTimeout(() => { dragged.current = false; }, 0);
  };

  const older = unit === 'audit' ? 'Previous audit' : 'Previous quarter';
  const newer = unit === 'audit' ? 'Next audit' : 'Next quarter';
  const many = n > 1;
  const nav = (
    <div className="flex items-center gap-3">
      {/* The slides by name (dates or quarters), latest first: the current one in ink. */}
      <div role="group" aria-label={unit === 'audit' ? 'Audits' : 'Quarters'} className="hidden items-center gap-1 rounded-full bg-fill p-[2px] min-[700px]:flex">
        {labels.map((l, i) => (
          <button
            key={l + i}
            type="button"
            onClick={() => go(i)}
            aria-label={l}
            aria-current={i === index ? 'true' : undefined}
            className={`h-7 whitespace-nowrap rounded-full px-3 text-[13px] transition-colors duration-500 ${i === index ? 'bg-surface font-semibold text-ink dark:bg-[#636366]' : 'text-muted hover:text-ink'}`}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <NavButton label={newer} hint={unit === 'audit' ? 'Newer audit (←)' : 'Newer quarter (←)'} disabled={index === 0} onClick={() => go(index - 1)}>
          <ChevronLeft size={18} strokeWidth={2.4} aria-hidden />
        </NavButton>
        <NavButton label={older} hint={unit === 'audit' ? 'Earlier audit (→)' : 'Earlier quarter (→)'} disabled={index === n - 1} onClick={() => go(index + 1)}>
          <ChevronRight size={18} strokeWidth={2.4} aria-hidden />
        </NavButton>
      </div>
    </div>
  );

  return (
    <section aria-roledescription="carousel" aria-label={unit === 'audit' ? 'Audit history' : 'Quarters'} data-testid="carousel" data-index={index} data-ready={measured ? '' : undefined} className={fit ? 'flex min-h-0 flex-1 flex-col' : undefined}>
      {trend ? (
        <div data-testid="carousel-head" className={`grid grid-cols-1 gap-x-[var(--gap-grid)] gap-y-3 px-[var(--gutter)] min-[900px]:grid-cols-12 ${fit ? 'shrink-0 pb-[var(--gap-grid)]' : 'pb-[clamp(10px,1.6svh,18px)]'}`}>
          <div className="flex min-w-0 flex-col justify-between gap-3 min-[900px]:col-span-4">
            <div className="min-w-0">{title}</div>
            {many && nav}
          </div>
          <div className="h-[clamp(110px,18svh,250px)] [@media(max-height:700px)]:h-[96px] [@media(min-height:901px)]:h-[clamp(110px,22svh,280px)] min-w-0 min-[900px]:col-span-8">
            <ScoreTrend points={trend} active={n - 1 - index} onSelect={(i) => go(n - 1 - i)} />
          </div>
        </div>
      ) : (
        <div className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-[var(--gutter)] ${fit ? 'shrink-0 pb-[clamp(8px,1.2svh,16px)]' : 'pb-[clamp(10px,1.6svh,18px)]'}`}>
          <div className="min-w-0">{title}</div>
          {many && nav}
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {many ? `${index + 1} of ${n}: ${labels[index]}` : ''}
      </p>

      <div data-clip-x className={fit ? 'min-h-0 flex-1 overflow-x-clip' : 'overflow-x-clip'}>
        <motion.div
          ref={track}
          drag={many ? 'x' : false}
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
            // Before hydration (and without JS) the server-chosen slide is placed by CSS alone.
            translate: measured ? undefined : `calc(-${index} * (100% - 2 * var(--gutter) + var(--gap-grid)))`,
          }}
          className={`flex gap-[var(--gap-grid)] px-[var(--gutter)] ${fit ? 'h-full items-stretch' : 'items-start'} ${many ? 'cursor-grab active:cursor-grabbing' : ''}`}
        >
          {slides.map((slide, i) => {
            const active = i === index;
            return (
              <div
                key={labels[i] + i}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${n}: ${labels[i]}`}
                aria-hidden={active ? undefined : true}
                data-testid="slide"
                data-active={active ? '' : undefined}
                className={`relative w-full min-w-0 shrink-0 transition-opacity duration-300 motion-reduce:transition-none ${fit ? 'h-full' : ''}`}
                style={{ opacity: active ? 1 : 0.42 }}
              >
                <div inert={!active} className={fit ? 'h-full' : undefined}>{slide}</div>
                {!active && (
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden
                    onClick={() => go(i)}
                    className="absolute inset-0 z-10 cursor-pointer rounded-[var(--radius-card)]"
                  />
                )}
              </div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

export function NavButton({ label, hint, disabled, onClick, children }: { label: string; hint: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={hint}
      disabled={disabled}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-full bg-surface text-ink shadow-[var(--shadow-card)] transition-[transform,opacity,background-color] duration-200 enabled:hover:bg-surface-2 enabled:active:scale-90 disabled:cursor-default disabled:opacity-35"
    >
      {children}
    </button>
  );
}
