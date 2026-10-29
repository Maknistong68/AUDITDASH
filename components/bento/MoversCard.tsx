'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { HandoffLink } from '@/components/motion/HandoffLink';
import type { Mover } from '@/lib/analytics';
import { pct, quarterLabel } from '@/lib/format';
import { CONTRACTOR_NAME } from '@/lib/handoff';
import type { Quarter } from '@/lib/types';
import { BentoCard, PRESS, SPRING, TileLabel } from './BentoGrid';
import { PAD, Signed } from './parts';

/**
 * M tile: the biggest rise and the biggest fall since the previous quarter (official totals, whole points). Every row is a full-width tap target that opens the contractor, its name morphing into the page title.
 */
export function MoversCard({ quarter, up, down, compared, query }: {
  quarter: Quarter; up: Mover[]; down: Mover[]; compared: number; query: string;
}) {
  const rows = [...up.slice(0, 1).map((m) => ({ m, dir: 'up' as const })), ...down.slice(0, 1).map((m) => ({ m, dir: 'down' as const }))];
  return (
    <BentoCard i={3} testid="kpi-movers" className={`${PAD} gap-[clamp(4px,0.8svh,10px)] min-[640px]:col-span-3`}>
      <TileLabel>
        <span className="text-ink">Biggest movers</span>
      </TileLabel>
      {rows.length === 0 ? (
        <p data-testid="movers-none" className="flex flex-1 items-center text-[14px] text-muted">
          {compared === 0 ? 'No previous quarter to compare yet' : 'No change since last quarter'}
        </p>
      ) : (
        <ul className="-mx-2 flex min-h-0 flex-1 flex-col justify-center gap-[clamp(2px,0.6svh,8px)]">
          {rows.map(({ m, dir }, i) => (
            <MoverRow key={m.contractor.id} m={m} dir={dir} i={i} query={query} />
          ))}
        </ul>
      )}
      <p className="truncate text-[12px] text-muted">
        {quarterLabel(quarter)} vs quarter before · {compared} compared
      </p>
    </BentoCard>
  );
}

function MoverRow({ m, dir, i, query }: { m: Mover; dir: 'up' | 'down'; i: number; query: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      data-testid="mover-row"
      data-dir={dir}
      data-handoff-card=""
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING, delay: 0.35 + i * 0.06 }}
      whileTap={reduce ? undefined : { scale: 0.98, transition: PRESS }}
      className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-[12px] px-2 py-[clamp(3px,0.6svh,7px)] transition-colors duration-200 hover:bg-fill-2"
    >
      <HandoffLink
        href={`/contractor/${m.contractor.id}${query}`}
        aria-label={`${m.contractor.name}: ${dir === 'up' ? 'up' : 'down'} ${Math.abs(m.change)} points, ${pct(m.previous)}% to ${pct(m.total)}%`}
        className="absolute inset-0 z-[1] rounded-[12px]"
      />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[clamp(14px,1.8svh,17px)] font-semibold tracking-[-0.01em]" title={m.contractor.name}>
          <span data-handoff={CONTRACTOR_NAME}>{m.contractor.name}</span>
        </span>
        <span className="num truncate text-[12px] text-muted">
          {dir === 'up' ? 'Rise' : 'Fall'} · {m.contractor.subregion} · {pct(m.previous)}% → {pct(m.total)}%
        </span>
      </span>
      <span className="text-[clamp(15px,2svh,20px)]">
        <Signed d={m.change} />
      </span>
    </motion.li>
  );
}
