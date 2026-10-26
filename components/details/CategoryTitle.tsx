'use client';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { CATEGORY_ICONS } from '@/components/charts/categoryIcons';
import { categoryById } from '@/lib/categories';
import type { CategoryId } from '@/lib/types';

/** The category's header tile: the inverted Apple tile of the main problem, shared via layoutId `cat-<id>`,
 * and the target of the Main Problem card's view-transition hand-off (data-handoff-target, lib/handoff.ts). */
export function CategoryTitle({ id, meta, as = 'h1' }: { id: CategoryId; meta: string; as?: 'h1' | 'p' }) {
  const c = categoryById(id);
  const Icon = CATEGORY_ICONS[c.icon];
  const Tag = as;
  // Arriving through the Main Problem view-transition hand-off: the view transition is the morph, so skip framer's
  // shared-layout morph (from the Where-it-fails row), which would fight it and freeze mid-way.
  const [viaHandoff] = useState(() => typeof document !== 'undefined' && 'handoff' in document.documentElement.dataset);
  return (
    <motion.div
      layoutId={viaHandoff ? undefined : `cat-${id}`}
      data-testid="category-title"
      data-handoff-target=""
      className="hero-tile flex min-w-0 items-center gap-[clamp(12px,1.2vw,18px)] rounded-[var(--radius-card)] py-[clamp(12px,1.8svh,18px)] pl-[clamp(14px,1.4vw,22px)] pr-[clamp(18px,2vw,32px)]"
    >
      <span className="grid size-[clamp(40px,5.4svh,52px)] shrink-0 place-items-center rounded-[14px]" style={{ background: 'var(--hero-chip)' }}>
        {Icon && <Icon size={24} strokeWidth={2.2} style={{ color: 'var(--hero-accent)' }} aria-hidden />}
      </span>
      <div className="min-w-0">
        <Tag data-handoff-name="" className="text-[22px] min-[900px]:text-[clamp(22px,3.2svh,32px)] font-semibold leading-[1.05] tracking-[-0.03em]">{c.name}</Tag>
        <p className="mt-0.5 text-[13px]" style={{ color: 'var(--hero-muted)' }}>{meta}</p>
      </div>
    </motion.div>
  );
}
