'use client';
import { motion, useReducedMotion } from 'framer-motion';

export const SPRING = { type: 'spring', stiffness: 240, damping: 28, mass: 0.9 } as const;

/**
 * One bento tile: a single rounded surface with one job. Rises in on a stagger (index).
 * `tone` adds a band/status tone class; `dark` makes it the inverted Apple tile (the screen's hero tile).
 */
export function BentoCard({
  i,
  testid,
  className = '',
  label,
  handoff,
  children,
}: {
  i: number;
  /** The card's name in the shared "card opens" hand-off (lib/handoff), when it opens a detail view. */
  handoff?: string;
  testid?: string;
  className?: string;
  label?: string;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      data-testid={testid}
      data-handoff={handoff}
      data-handoff-card={handoff ? '' : undefined}
      aria-label={label}
      initial={reduce ? false : { opacity: 0, y: 22, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...SPRING, delay: 0.05 + i * 0.07 }}
      className={`card relative flex min-h-0 min-w-0 flex-col ${className}`}
    >
      {children}
    </motion.section>
  );
}

/** The tile label: small, semibold, optional tone colour and icon. */
export function TileLabel({ children, tone, className = '' }: { children: React.ReactNode; tone?: string; className?: string }) {
  return (
    <h2
      className={`flex items-center gap-1.5 text-[clamp(13px,1.5svh,16px)] font-semibold tracking-[-0.01em] ${className}`}
      style={{ color: tone ?? 'var(--muted)' }}
    >
      {children}
    </h2>
  );
}

/**
 * Bento layout. ≥1200px: XL contractors tile on the left at full hero height; the right half is a 6-column
 * grid: L main problem (6) / M score (3) + M repeats (3) / S high-risk, bands, region (2 each).
 * Narrower: everything stacks and the page scrolls.
 */
export function BentoGrid({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-[var(--gap-grid)] min-[1200px]:grid-cols-[minmax(0,1.18fr)_minmax(0,1fr)]">
      {left}
      <div className="grid min-h-0 grid-cols-1 gap-[var(--gap-grid)] min-[640px]:grid-cols-6 min-[1200px]:grid-rows-[minmax(0,1.38fr)_minmax(0,1fr)_minmax(0,1fr)]">
        {right}
      </div>
    </div>
  );
}
