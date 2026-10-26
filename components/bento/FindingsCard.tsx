'use client';
import Link from 'next/link';
import { ListChecks, Repeat2, TriangleAlert } from 'lucide-react';
import { CountUp } from '@/components/motion/CountUp';
import { int } from '@/lib/format';
import { BentoCard, TileLabel } from './BentoGrid';
import { MID, PAD, SubLabel } from './parts';

const DIVIDE = 'min-[640px]:border-l min-[640px]:border-[var(--hairline)] min-[640px]:pl-[clamp(16px,1.6vw,32px)]';

/**
 * Findings / open actions: repeat findings (with the items repeated by the most contractors, each linking to
 * the item), high-risk work findings (opens Documents) and open corrective actions, which come
 * from audits entered in the app (none yet, so "—").
 */
export function FindingsCard({ repeats, top, highRisk, highRiskHref }: {
  repeats: number | null;
  top: { itemCode: string; question: string; contractors: number; href: string }[];
  highRisk: number;
  highRiskHref: string;
}) {
  return (
    <BentoCard i={4} testid="findings-actions" label="Findings and open actions" className={`${PAD} gap-[clamp(6px,1.1svh,14px)] min-[640px]:col-span-12`}>
      <TileLabel className="text-ink">Findings · open actions</TileLabel>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-x-[clamp(16px,1.6vw,32px)] gap-y-4 min-[640px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div data-testid="kpi-repeats" className="tone-minimal flex min-w-0 flex-col justify-between gap-[clamp(4px,0.8svh,10px)]">
          <SubLabel tone="var(--tone)">
            <Repeat2 size={15} strokeWidth={2.4} aria-hidden />
            Repeat findings
          </SubLabel>
          <div className="flex items-end gap-3">
            <p className={MID}>{repeats === null ? <span className="text-faint">—</span> : <CountUp value={repeats} format={int} duration={1.2} delay={0.3} />}</p>
            <p className="pb-[0.35em] text-[13px] leading-tight text-muted">{repeats === null ? 'Needs an earlier quarter' : 'same item noted again in a later quarter'}</p>
          </div>
          {top.length > 0 && (
            <ul className="-mx-1.5 grid gap-[clamp(0px,0.3svh,4px)]" aria-label="Most repeated items">
              {top.map((t) => (
                <li key={t.itemCode}>
                  <Link
                    href={t.href}
                    data-testid="repeat-row"
                    title={t.question}
                    aria-label={`${t.itemCode} ${t.question}: ${t.contractors} ${t.contractors === 1 ? 'contractor' : 'contractors'}`}
                    className="grid grid-cols-[2.8em_minmax(0,1fr)_auto] items-baseline gap-2 rounded-lg px-1.5 py-[1px] text-[13px] transition-colors hover:bg-fill-2"
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
        </div>
        <div data-testid="kpi-highrisk" className={`tone-non relative flex min-w-0 flex-col justify-between gap-[clamp(4px,0.8svh,10px)] ${DIVIDE}`}>
          <Link
            href={highRiskHref}
            aria-label={`High-risk work: ${highRisk} findings. Open Documents`}
            className="absolute -inset-y-1.5 inset-x-0 z-[1] rounded-xl transition-colors hover:bg-fill-2 min-[640px]:left-[clamp(4px,0.6vw,12px)]"
          />
          <SubLabel tone="var(--tone)">
            <TriangleAlert size={14} strokeWidth={2.4} aria-hidden />
            High-risk work
          </SubLabel>
          <p className={MID}>
            <CountUp value={highRisk} format={int} duration={1.2} delay={0.36} />
          </p>
          <p className="text-[13px] leading-tight text-muted">Permits, lifting, height, electrical</p>
        </div>
        <div data-testid="open-actions" className={`flex min-w-0 flex-col justify-between gap-[clamp(4px,0.8svh,10px)] ${DIVIDE}`}>
          <SubLabel>
            <ListChecks size={14} strokeWidth={2.4} aria-hidden />
            Open actions
          </SubLabel>
          <p className={MID} aria-label="No open actions tracked yet">
            <span className="text-faint">—</span>
          </p>
          <p className="text-[12px] leading-tight text-muted">From audits entered with + New Audit</p>
        </div>
      </div>
    </BentoCard>
  );
}
