'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { handoffPending } from '@/lib/handoff';
import { calm, DUR, EASE, RISE, STAGGER } from '@/lib/motion';

/** Every entrance: the house curve (lib/motion), 1.5 s expo-out. Kept under its old name for the call sites. */
export const SPRING = { type: 'tween', ease: EASE, duration: DUR } as const;

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
  landing,
  children,
}: {
  i: number;
  /** The card's name in the shared "card opens" hand-off (lib/handoff), when it opens a detail view. */
  handoff?: string;
  /** The hand-off name this card lands (a drill-down's first card): the clicked row grows into it, so it skips its rise. */
  landing?: string;
  testid?: string;
  className?: string;
  label?: string;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const [landed] = useState(() => !!landing && handoffPending());
  return (
    <motion.section
      data-testid={testid}
      data-handoff={handoff}
      data-handoff-card={handoff ? '' : undefined}
      aria-label={label}
      style={landing ? { viewTransitionName: landing } : undefined}
      initial={reduce || landed ? false : RISE.initial}
      animate={RISE.animate}
      transition={calm(0.05 + i * STAGGER)}
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
 * Bento layout. ≥1200px: the left half is split in the middle: contractors ranked (top) and the score over time (bottom);
 * the right half is a 6-column grid: L main problem (6) / M portfolio score (3) + M repeats (3) / S regions (2) +
 * S audits conducted (2) + S positives (2).
 * Narrower: everything stacks and the page scrolls.
 */
export function BentoGrid({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-[var(--gap-grid)] min-[1200px]:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)]">
      <div className="grid min-h-0 grid-cols-1 gap-[var(--gap-grid)] min-[1200px]:grid-rows-[minmax(0,1.08fr)_minmax(0,0.92fr)]">{left}</div>
      <div className="grid min-h-0 grid-cols-1 gap-[var(--gap-grid)] min-[640px]:grid-cols-6 min-[1200px]:grid-rows-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.82fr)]">
        {right}
      </div>
    </div>
  );
}
