'use client';
import Link from 'next/link';
import { Repeat2 } from 'lucide-react';
import { CountUp } from '@/components/motion/CountUp';
import { int } from '@/lib/format';
import { BentoCard, TileLabel } from './BentoGrid';
import { BIG, PAD } from './parts';

/**
 * M: repeat findings, plus the items repeated by the most contractors (top 3). Each row links to the item:
 * its item page when one contractor repeats it, else the item inside the category view.
 */
export function RepeatsCard({ repeats, top }: {
  repeats: number | null; top: { itemCode: string; question: string; contractors: number; href: string }[];
}) {
  return (
    <BentoCard i={3} testid="kpi-repeats" className={`tone-minimal ${PAD} justify-between gap-2 min-[640px]:col-span-3`}>
      <TileLabel tone="var(--tone)">
        <Repeat2 size={16} strokeWidth={2.4} aria-hidden />
        Repeat findings
      </TileLabel>
      <div className="flex items-end gap-3">
        <p className={BIG}>{repeats === null ? <span className="text-faint">—</span> : <CountUp value={repeats} format={int} duration={1.2} delay={0.3} />}</p>
        <p className="pb-[0.5em] text-[13px] leading-tight text-muted">{repeats === null ? 'Needs an earlier quarter' : 'same item noted again in a later quarter'}</p>
      </div>
      {top.length > 0 && (
        <ul className="-mx-1.5 grid gap-[clamp(1px,0.4svh,4px)]" aria-label="Most repeated items">
          {top.map((t) => (
            <li key={t.itemCode}>
              <Link
                href={t.href}
                data-testid="repeat-row"
                title={t.question}
                aria-label={`${t.itemCode} ${t.question}: ${t.contractors} ${t.contractors === 1 ? 'contractor' : 'contractors'}`}
                className="grid grid-cols-[2.8em_minmax(0,1fr)_auto] items-baseline gap-2 rounded-lg px-1.5 py-[2px] text-[13px] transition-colors hover:bg-fill-2"
              >
                <span className="num rounded-md bg-fill px-1.5 text-center text-[12px] font-semibold text-muted">{t.itemCode}</span>
                <span className="truncate">{t.question}</span>
                <span className="num text-muted">
                  <span className="font-semibold text-ink">{t.contractors}</span> contr.
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </BentoCard>
  );
}
