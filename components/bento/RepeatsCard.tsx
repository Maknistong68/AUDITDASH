'use client';
import { Repeat2 } from 'lucide-react';
import { CountUp } from '@/components/motion/CountUp';
import { int } from '@/lib/format';
import { BentoCard, TileLabel } from './BentoGrid';
import { BIG, PAD } from './parts';

/** M: repeat findings, plus the items repeated by the most contractors (top 3). */
export function RepeatsCard({ repeats, top }: {
  repeats: number | null; top: { itemCode: string; question: string; contractors: number }[];
}) {
  return (
    <BentoCard i={3} testid="kpi-repeats" className={`tone-minimal ${PAD} justify-between gap-2 min-[640px]:col-span-3`}>
      <TileLabel tone="var(--tone)">
        <Repeat2 size={16} strokeWidth={2.4} aria-hidden />
        Repeat findings
      </TileLabel>
      <div className="flex items-end gap-3">
        <p className={BIG}>{repeats === null ? <span className="text-faint">—</span> : <CountUp value={repeats} format={int} duration={1.2} delay={0.3} />}</p>
        <p className="pb-[0.5em] text-[13px] leading-tight text-muted">{repeats === null ? 'Needs an earlier quarter' : 'same item failed again'}</p>
      </div>
      {top.length > 0 && (
        <ul className="grid gap-[clamp(3px,0.7svh,8px)]" aria-label="Most repeated items">
          {top.map((t) => (
            <li key={t.itemCode} className="grid grid-cols-[2.8em_minmax(0,1fr)_auto] items-baseline gap-2 text-[13px]" title={t.question}>
              <span className="num rounded-md bg-fill px-1.5 text-center text-[12px] font-semibold text-muted">{t.itemCode}</span>
              <span className="truncate">{t.question}</span>
              <span className="num text-muted">
                <span className="font-semibold text-ink">{t.contractors}</span> contr.
              </span>
            </li>
          ))}
        </ul>
      )}
    </BentoCard>
  );
}
