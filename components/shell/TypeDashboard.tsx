import { auditTypeInfo } from '@/lib/auditTypeIds';
import { checklistFor, sectionsFor } from '@/lib/auditTypes';
import type { ContractorCard } from '@/lib/analytics';
import { pct, quarterLabel } from '@/lib/format';
import type { AuditType, Contractor, Quarter } from '@/lib/types';
import { BentoCard, BentoGrid } from '@/components/bento/BentoGrid';
import { ContractorsCard } from '@/components/bento/ContractorsCard';
import { NewAuditButton } from './NewAuditButton';

// Same as bento/parts PAD; a client module's constants are not plain values in a server component.
const PAD = 'px-[clamp(16px,1.5vw,28px)] py-[clamp(12px,1.8svh,24px)]';

export interface WeakestSection { quarter: Quarter; code: string; label: string; score: number; previous: number | null; audits: number }

/**
 * Security / Environmental / Welfare / CRC: the same director layout as H&S. Contractors ranked on the left; on the right
 * the weakest checklist section (dark hero), SR1 vs SR2, biggest movers and audits done. With no audit of the type yet,
 * the layout stays and says what will fill it: the type's own sections from its checklist, awaiting the first audit.
 */
export function TypeDashboard({ type, cards, contractors, weakest, tiles }: {
  type: AuditType; cards: ContractorCard[]; contractors: Contractor[]; weakest: WeakestSection | null; tiles: React.ReactNode | null;
}) {
  const info = auditTypeInfo(type);
  // A one-section checklist (CRC) lists its areas instead, so the tile still says what will be scored.
  const one = sectionsFor(type).length === 1;
  const sections = one ? checklistFor(type).map((i) => ({ code: i.code.replace(/^CRC/, ''), title: i.question })) : sectionsFor(type);
  const unit = one ? 'area' : 'section';
  if (!tiles) {
    return (
      <BentoGrid
        left={
          <BentoCard i={0} testid="type-empty" label={`${info.label}: no audits yet`} className={`${PAD} gap-[clamp(8px,1.4svh,16px)]`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <p className="text-[15px] font-semibold text-muted">{info.label} · Contractors {contractors.length}</p>
                <h2 id="type-empty-title" className="text-[clamp(26px,4svh,40px)] font-semibold leading-[1.05] tracking-[-0.035em]">
                  Awaiting first audit
                </h2>
              </div>
              <NewAuditButton type={type} size="lg" />
            </div>
            <ul aria-label="Contractors waiting for their first audit" className="grid min-h-0 flex-1 auto-rows-[minmax(40px,1fr)] min-[1200px]:auto-rows-[minmax(0,1fr)]">
              {contractors.map((c) => (
                <li key={c.id} data-testid="type-empty-row" className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_3.3em] items-center gap-x-4 border-t border-[var(--hairline,rgba(0,0,0,0.06))] first:border-t-0">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[clamp(14px,1.7svh,17px)] font-semibold tracking-[-0.02em] text-muted">{c.name}</span>
                    <span className="text-[12px] text-faint">{c.subregion}</span>
                  </span>
                  <span className="block h-[clamp(6px,0.9svh,9px)] rounded-full bg-fill-2" aria-hidden />
                  <span className="figure text-right text-[clamp(18px,2.6svh,28px)] text-faint" aria-label="Not audited yet">—</span>
                </li>
              ))}
            </ul>
          </BentoCard>
        }
        right={
          <BentoCard i={1} testid="type-sections" className={`hero-tile ${PAD} col-span-full row-span-3 gap-4 overflow-hidden`}>
            <div className="flex flex-col gap-1">
              <p className="text-[clamp(13px,1.5svh,16px)] font-semibold" style={{ color: 'var(--hero-accent)' }}>{info.label} checklist</p>
              <h2 className="text-[clamp(24px,3.7svh,42px)] font-semibold leading-[1.05] tracking-[-0.03em]">
                {sections.length} {sections.length === 1 ? unit : `${unit}s`} will be scored
              </h2>
            </div>
            <p className="max-w-[46ch] text-[14px] leading-snug" style={{ color: 'var(--hero-muted)' }}>
              The weakest of these becomes this tab&apos;s main problem, with SR1 vs SR2, biggest movers and audits done beside it.
            </p>
            <ol className="grid min-h-0 grid-cols-1 content-start gap-x-6 gap-y-[clamp(6px,1.2svh,14px)] overflow-hidden min-[640px]:grid-cols-2">
              {sections.map((s) => (
                <li key={s.code} data-testid="type-section" className="flex min-w-0 items-baseline gap-2.5 text-[clamp(13px,1.6svh,16px)]">
                  <span className="num w-6 shrink-0 text-[13px] font-semibold" style={{ color: 'var(--hero-accent)' }}>{s.code}</span>
                  <span className="truncate" title={s.title}>{s.title}</span>
                </li>
              ))}
            </ol>
          </BentoCard>
        }
      />
    );
  }
  return (
    <BentoGrid
      left={<ContractorsCard cards={cards} />}
      right={
        <>
          {weakest && <WeakestSectionCard type={info.label} weakest={weakest} />}
          {tiles}
        </>
      }
    />
  );
}

function WeakestSectionCard({ type, weakest }: { type: string; weakest: WeakestSection }) {
  const lost = 1 - weakest.score;
  const d = weakest.previous === null ? null : Math.round(weakest.previous * 100) - Math.round(weakest.score * 100);
  return (
    <BentoCard i={1} testid="weakest-section" className={`hero-tile ${PAD} col-span-full justify-between gap-3`}>
      <div className="flex flex-col gap-[clamp(4px,0.8svh,10px)]">
        <p className="text-[clamp(13px,1.5svh,16px)] font-semibold" style={{ color: 'var(--hero-accent)' }}>
          {type} · weakest section · {quarterLabel(weakest.quarter)}
        </p>
        <h2 className="text-[clamp(24px,3.7svh,42px)] font-semibold leading-[1.05] tracking-[-0.03em]">{weakest.label}</h2>
      </div>
      <div className="flex items-end gap-4">
        <p className="figure text-[clamp(52px,12svh,160px)]" style={{ color: 'var(--hero-accent)' }}>
          {pct(lost)}<span className="text-[0.42em] tracking-normal">%</span>
        </p>
        <p className="flex flex-col gap-1 pb-[0.6em] text-[14px]" style={{ color: 'var(--hero-muted)' }}>
          <span>of points lost · {weakest.audits} {weakest.audits === 1 ? 'audit' : 'audits'}</span>
          {d !== null && d !== 0 && (
            <span className="font-semibold" style={{ color: d > 0 ? 'var(--hero-down)' : 'var(--hero-up)' }}>
              {Math.abs(d)} {Math.abs(d) === 1 ? 'pt' : 'pts'} {d > 0 ? 'worse' : 'better'} than last quarter
            </span>
          )}
        </p>
      </div>
    </BentoCard>
  );
}
