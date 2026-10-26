'use client';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScoreBar } from '@/components/bento/parts';
import { href } from '@/lib/details';
import { bandShort, bandTone, dateLabel, pct, quarterLabel } from '@/lib/format';
import type { Band, Quarter, Subregion } from '@/lib/types';
import { SectionHead } from './SectionHead';

export interface ReelAudit {
  id: string; date: string; score: number; band: Band; contractor: string; region: Subregion; quarter: Quarter;
}

const MotionLink = motion.create(Link);
const EASE = [0.16, 1, 0.3, 1] as const;

/** Snap positions (scrollLeft values) of the reel's cards, clamped to the scroll range. */
function snapPoints(el: HTMLElement): number[] {
  const pad = parseFloat(getComputedStyle(el).scrollPaddingLeft) || 0;
  const max = el.scrollWidth - el.clientWidth;
  return [...el.querySelectorAll<HTMLElement>('[data-testid="reel-card"]')].map((c) => Math.min(max, Math.max(0, c.offsetLeft - pad)));
}

/**
 * Past audits, newest first, as a horizontal reel that scrolls inside itself (scroll-snap). A vertical mouse
 * wheel scrolls it sideways only while it can still move that way, then hands back to the page. Snap is paused
 * while the wheel turns and resumes on the next card in the direction of travel. Prev/next page by a view.
 * The reel stays inside the page margins (cards are clipped at the margin, never against the screen edge).
 */
export function AuditReel({ audits, query }: { audits: ReelAudit[]; query: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: audits.length < 2 });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdge({ start: el.scrollLeft <= 1, end: el.scrollLeft >= max - 1 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    let idle: ReturnType<typeof setTimeout> | undefined;
    let dir = 0;
    const settle = () => {
      const pos = el.scrollLeft;
      const pts = snapPoints(el);
      const target = dir > 0 ? (pts.find((p) => p >= pos - 1) ?? pts.at(-1)) : ([...pts].reverse().find((p) => p <= pos + 1) ?? 0);
      el.scrollTo({ left: target ?? pos, behavior: reduce ? 'auto' : 'smooth' });
      idle = setTimeout(() => (el.style.scrollSnapType = ''), reduce ? 0 : 450);
    };
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return; // pinch / native sideways gestures
      const d = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientWidth : 1);
      const max = el.scrollWidth - el.clientWidth;
      if ((d < 0 && el.scrollLeft <= 0) || (d > 0 && el.scrollLeft >= max - 1)) return; // let the page scroll
      e.preventDefault();
      dir = Math.sign(d);
      el.style.scrollSnapType = 'none';
      el.scrollLeft = Math.min(max, Math.max(0, el.scrollLeft + d));
      clearTimeout(idle);
      idle = setTimeout(settle, 140);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      clearTimeout(idle);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [update, reduce]);

  const page = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const pts = snapPoints(el);
    if (pts.length < 2) return;
    const step = pts[1] - pts[0] || 1;
    const perView = Math.max(1, Math.floor(el.clientWidth / step) - 1);
    let i = 0;
    pts.forEach((p, k) => {
      if (Math.abs(p - el.scrollLeft) < Math.abs(pts[i] - el.scrollLeft)) i = k;
    });
    const next = Math.min(pts.length - 1, Math.max(0, i + dir * perView));
    el.scrollTo({ left: pts[next], behavior: reduce ? 'auto' : 'smooth' });
  };

  const btn =
    'grid size-10 place-items-center rounded-full bg-surface text-ink shadow-[var(--shadow-card)] transition-[opacity,background-color] duration-200 hover:bg-surface-2 disabled:cursor-default disabled:opacity-35 disabled:hover:bg-surface';

  return (
    <>
      <SectionHead id="reel-title" title="Past audits" note={`${audits.length} ${audits.length === 1 ? 'audit' : 'audits'} · newest first`}>
        <div className="flex shrink-0 gap-2">
          <button type="button" className={btn} aria-label="Scroll past audits left" disabled={edge.start} onClick={() => page(-1)}>
            <ChevronLeft size={20} strokeWidth={2.4} aria-hidden />
          </button>
          <button type="button" className={btn} aria-label="Scroll past audits right" disabled={edge.end} onClick={() => page(1)}>
            <ChevronRight size={20} strokeWidth={2.4} aria-hidden />
          </button>
        </div>
      </SectionHead>
      <motion.div
        ref={ref}
        data-testid="reel"
        role="region"
        aria-label="Past audits, scrolls sideways"
        className="relative -my-6 flex snap-x snap-mandatory gap-[var(--gap-grid)] overflow-x-auto overscroll-x-contain py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        initial={reduce ? false : 'hidden'}
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={{ show: { transition: { staggerChildren: 0.05 } } }}
      >
        {audits.map((a) => {
          const tone = bandTone(a.band);
          return (
            <MotionLink
              key={a.id}
              href={href(`/audit/${a.id}`, query)}
              data-testid="reel-card"
              data-date={a.date}
              aria-label={`${a.contractor}, ${dateLabel(a.date)}, ${pct(a.score)}%, ${a.band}`}
              className={`tone-${tone} card lift flex w-[clamp(248px,15vw,280px)] shrink-0 snap-start flex-col gap-[clamp(14px,2svh,20px)] p-[clamp(18px,1.3vw,24px)] transition-[translate,box-shadow] duration-300 hover:-translate-y-1`}
              variants={{ hidden: { opacity: 0, x: 28 }, show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: EASE } } }}
            >
              <span className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-[16px] font-semibold tracking-[-0.015em]" title={a.contractor}>
                  {a.contractor}
                </span>
                <span className="num text-[13px] text-muted">{dateLabel(a.date)}</span>
              </span>
              <span className="flex items-end justify-between gap-2">
                <span className="figure text-[clamp(40px,5svh,56px)]">
                  {pct(a.score)}
                  <span className="text-[0.42em] tracking-normal text-muted">%</span>
                </span>
                <span className="badge mb-1 px-2 py-[2px] text-[13px]" title={a.band}>
                  {bandShort(a.band)}
                </span>
              </span>
              <ScoreBar value={a.score} delay={0} />
              <span className="num flex justify-between text-[12px] text-muted">
                <span>{a.region}</span>
                <span>{quarterLabel(a.quarter)}</span>
              </span>
            </MotionLink>
          );
        })}
      </motion.div>
    </>
  );
}
