'use client';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { CategoryChip, CodeChip } from '@/components/details/parts';
import { Sparkline } from '@/components/charts/Sparkline';
import { href } from '@/lib/details';
import { sparkRates } from '@/lib/spark';
import type { CategoryId, Quarter } from '@/lib/types';

export interface IssueRow {
  itemCode: string; question: string; category: CategoryId; auditsHit: number; auditsTotal: number; byQuarter: Record<Quarter, number>;
}

const MotionLink = motion.create(Link);
const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The six highest-impact checklist items (topIssues order: audits noted × score lost, one per subsection).
 * "Noted in N of M audits" counts auditor notes, which are not failures. The sparkline is the share of each
 * quarter's audits that noted the item. Each card opens the category details at that item.
 */
export function MainIssues({ rows, auditsByQuarter, query }: { rows: IssueRow[]; auditsByQuarter: Record<Quarter, number>; query: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.ol
      className="grid grid-cols-1 gap-[var(--gap-grid)] min-[760px]:grid-cols-2 min-[1100px]:grid-cols-3"
      initial={reduce ? false : 'hidden'}
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
    >
      {rows.map((r) => {
        const spark = sparkRates(r.byQuarter, auditsByQuarter).map((p) => ({ label: p.quarter.slice(0, 2), rate: p.rate }));
        return (
          <motion.li
            key={r.itemCode}
            className="flex min-w-0"
            variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } } }}
          >
            <MotionLink
              href={href(`/category/${r.category}`, query, { hash: `item-${r.itemCode}` })}
              data-testid="issue-card"
              data-item={r.itemCode}
              title={r.question}
              className="card lift flex w-full min-w-0 flex-col gap-[clamp(14px,2svh,22px)] p-[clamp(18px,1.5vw,28px)] transition-[translate,box-shadow] duration-300 hover:-translate-y-1"
            >
              <span className="flex items-center justify-between gap-3">
                <CategoryChip id={r.category} short />
                <CodeChip code={r.itemCode} />
              </span>
              <span className="line-clamp-2 min-h-[2lh] text-[clamp(16px,1.9svh,19px)] font-semibold leading-snug tracking-[-0.015em]">{r.question}</span>
              <span className="mt-auto flex items-end justify-between gap-4">
                <span className="flex min-w-0 flex-col gap-1.5">
                  <span className="figure text-[clamp(36px,4.6svh,52px)]">
                    {r.auditsHit}
                    <span className="text-[0.5em] tracking-normal text-muted">/{r.auditsTotal}</span>
                  </span>
                  <span className="num text-[13px] text-muted">
                    noted in {r.auditsHit} of {r.auditsTotal} audits
                  </span>
                </span>
                <Sparkline points={spark} label={`Share of audits noting ${r.itemCode} by quarter`} />
              </span>
            </MotionLink>
          </motion.li>
        );
      })}
    </motion.ol>
  );
}
