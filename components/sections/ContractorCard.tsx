'use client';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Check, Plus } from 'lucide-react';
import { ActivityRings, RING_META } from '@/components/charts/ActivityRings';
import { CountUp } from '@/components/motion/CountUp';
import { bandShort, bandTone, deltaPoints, pct, prevQuarterShort } from '@/lib/format';
import type { ContractorCard as Card } from '@/lib/analytics';

const whole = (n: number) => String(Math.round(n));

export function Delta({ total, previous, auditId, size = 13 }: { total: number; previous: number | null; auditId: string; size?: number }) {
  const d = deltaPoints(total, previous);
  if (d === null) return null;
  const vs = prevQuarterShort(auditId);
  const color = d > 0 ? 'var(--up)' : d < 0 ? 'var(--down)' : 'var(--muted)';
  return (
    <span
      className="num inline-flex items-center gap-0.5 font-semibold"
      style={{ color, fontSize: size }}
      title={`${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)} points vs ${vs ?? 'previous audit'} (${pct(previous)}%)`}
    >
      {d > 0 && <ArrowUp size={size} strokeWidth={2.6} aria-hidden />}
      {d < 0 && <ArrowDown size={size} strokeWidth={2.6} aria-hidden />}
      <span>{d > 0 ? '+' : d < 0 ? '−' : '±'}{Math.abs(d)}</span>
      {vs && <span className="ml-0.5 font-normal text-muted">vs {vs}</span>}
    </span>
  );
}

/**
 * One contractor: rank, name, region, three activity rings, the official total, band badge and Δ.
 * The whole card is a link (stretched); the compare toggle sits above it and never triggers navigation.
 */
export function ContractorCard({
  card,
  index,
  selected,
  disabled,
  onToggle,
  animateIn,
}: {
  card: Card;
  index: number;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
  animateIn: boolean;
}) {
  const { contractor, rings, total, band, previous, rank, auditId } = card;
  const tone = bandTone(band);
  const ringDelay = animateIn ? 0.32 + index * 0.045 : 0.05;

  return (
    <div
      data-testid="contractor-card"
      className={`card lift relative h-full min-h-0 [container-type:size] ${selected ? 'outline-2 outline-offset-0 outline-[var(--accent)]' : ''}`}
    >
      <div className="relative z-0 flex h-full min-h-0 flex-col p-[clamp(12px,5.5cqh,22px)]">
        <div className="flex h-[26px] items-center gap-2 pr-9">
          <span className="num grid h-[22px] min-w-[22px] place-items-center rounded-full bg-fill px-1.5 text-[12px] font-semibold text-muted">
            {rank}
          </span>
          <span className="text-[13px] font-medium text-muted">{contractor.subregion}</span>
        </div>
        <h3
          className="mt-[clamp(4px,2cqh,8px)] line-clamp-2 h-[2.5em] text-[clamp(14px,5.2cqh,18px)] font-semibold leading-[1.25] tracking-[-0.02em]"
          title={contractor.name}
        >
          {contractor.name}
        </h3>

        <div className="flex min-h-0 flex-1 items-center justify-center gap-[clamp(8px,5cqw,18px)] py-[clamp(4px,2.4cqh,14px)]">
          <ActivityRings rings={rings} delay={ringDelay} className="aspect-square h-full max-h-full min-w-0 max-w-[72%]" />
          <ul className="flex shrink-0 flex-col gap-[clamp(2px,1.2cqh,6px)]" aria-hidden>
            {RING_META.map((m) => (
              <li key={m.key} className="num flex items-center gap-1.5 text-[clamp(13px,4cqh,15px)] font-semibold" title={m.full}>
                <span className="w-[1ch] text-[0.85em]" style={{ color: m.color }}>{m.key}</span>
                <span className="text-ink">{pct(rings[m.key])}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-end justify-between gap-2">
          <p className="figure text-[clamp(28px,13.5cqh,50px)]" aria-label={`Total ${pct(total)} percent`}>
            <CountUp value={total * 100} format={whole} duration={1.1} delay={animateIn ? 0.3 + index * 0.045 : 0} />
            <span className="ml-0.5 text-[0.5em] tracking-normal text-muted">%</span>
          </p>
          <div className="flex min-w-0 flex-col items-end gap-1 pb-0.5">
            <span className={`badge tone-${tone} px-2 py-[2px] text-[13px]`} title={band}>
              {bandShort(band)}
            </span>
            <span className="flex h-[16px] items-center">
              <Delta total={total} previous={previous} auditId={auditId} size={13} />
            </span>
          </div>
        </div>
      </div>

      <Link
        href={`/contractor/${contractor.id}`}
        aria-label={`${contractor.name}, rank ${rank}, ${pct(total)}%, ${band}`}
        className="absolute inset-0 z-[1] rounded-[var(--radius-card)] focus-visible:outline-offset-2"
      />
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`Compare ${contractor.name}`}
        disabled={disabled}
        onClick={onToggle}
        title={disabled ? 'Up to 3 contractors' : selected ? 'Remove from compare' : 'Add to compare'}
        className={`absolute right-[clamp(10px,4cqh,16px)] top-[clamp(10px,4cqh,16px)] z-[2] grid size-[26px] place-items-center rounded-full transition-[background-color,transform,opacity,box-shadow] duration-200 active:scale-90 disabled:cursor-not-allowed disabled:opacity-35 ${
          selected
            ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-[0_2px_8px_-2px_var(--accent)]'
            : 'bg-fill-2 text-muted shadow-[inset_0_0_0_1.5px_var(--control)] hover:text-ink enabled:hover:bg-fill'
        }`}
      >
        {selected ? <Check size={15} strokeWidth={3} aria-hidden /> : <Plus size={15} strokeWidth={2.6} aria-hidden />}
      </button>
    </div>
  );
}
