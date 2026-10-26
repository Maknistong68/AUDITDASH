'use client';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { bandFor } from '@/lib/scoring';
import { bandColor, pct, pts } from '@/lib/format';
import type { Contractor } from '@/lib/types';

export interface LeagueRow { contractor: Contractor; latest: number; previous: number | null }

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Contractor league: best first, bar length = latest audit score on a 0–100% scale, bar in the band colour.
 * An arrow shows the change vs the contractor's previous audit only when one exists.
 */
export function LeagueBars({ rows }: { rows: LeagueRow[] }) {
  const reduce = useReducedMotion();
  return (
    <ol className="flex min-h-0 flex-1 flex-col">
      {rows.map((r, i) => {
        const band = bandFor(r.latest);
        const change = r.previous === null ? null : r.latest - r.previous;
        return (
          <motion.li
            key={r.contractor.id}
            layout="position"
            className="flex min-h-0 flex-col justify-center"
            style={{ flex: '1 1 0', minHeight: 40, maxHeight: 76 }}
            transition={{ layout: { duration: 0.45, ease: EASE } }}
          >
            <Link
              href={`/contractor/${r.contractor.id}`}
              data-testid="league-row"
              aria-label={`${r.contractor.name}: ${pct(r.latest)}%, ${band}${change !== null ? `, ${pts(change)} points vs previous audit` : ''}`}
              className="group -mx-2 flex flex-col gap-1.5 rounded-[var(--radius-control)] px-2 py-1 transition-colors hover:bg-raised"
            >
              <span className="flex items-baseline gap-3 text-[14px] leading-5">
                <span className="min-w-0 flex-1 truncate">{r.contractor.name}</span>
                <span className="w-[54px] shrink-0 text-right">
                  {change !== null && Math.abs(change) >= 0.005 && (
                    <span
                      className="num inline-flex items-center gap-0.5 text-[12px] font-medium"
                      style={{ color: change > 0 ? 'var(--positive)' : 'var(--negative)' }}
                    >
                      {change > 0 ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />}
                      {Math.round(Math.abs(change) * 100)}
                    </span>
                  )}
                </span>
                <span className="num w-[42px] shrink-0 text-right font-semibold">
                  {pct(r.latest)}<span className="text-[12px] font-medium text-muted">%</span>
                </span>
              </span>
              <span className="relative block h-1.5 overflow-hidden rounded-full bg-[var(--track)]" aria-hidden>
                <motion.span
                  className="absolute inset-y-0 left-0 origin-left rounded-full"
                  style={{ width: `${r.latest * 100}%`, background: bandColor(band) }}
                  initial={reduce ? false : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.8, delay: reduce ? 0 : 0.2 + i * 0.04, ease: EASE }}
                />
              </span>
            </Link>
          </motion.li>
        );
      })}
    </ol>
  );
}
