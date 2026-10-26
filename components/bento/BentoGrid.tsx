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
  children,
}: {
  i: number;
  testid?: string;
  className?: string;
  label?: string;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      data-testid={testid}
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
 * Dashboard grid. ≥1200px, one viewport: Contractors (ranked) fill the left column at full hero height; the right
 * column is a 12-column grid of three aligned rows — Main problem (12, the most prominent) / Audit overview (7) +
 * Audit trends (5) / Findings · open actions (12). The two lower rows take their content height and the main
 * problem takes the rest, so spare height goes to the most important card instead of gaps inside small ones.
 * One gutter everywhere; every card fills its cell.
 * Narrower: everything stacks and the page scrolls.
 */
export function BentoGrid({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-[var(--gap-grid)] min-[1200px]:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
      {left}
      <div className="grid min-h-0 grid-cols-1 gap-[var(--gap-grid)] min-[640px]:grid-cols-12 min-[1200px]:grid-rows-[minmax(0,1fr)_auto_auto]">
        {right}
      </div>
    </div>
  );
}
