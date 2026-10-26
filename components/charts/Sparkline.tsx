import { pct } from '@/lib/format';

const W = 112;
const H = 44;
const PAD = 4;

/**
 * A two-quarter trend on a fixed 0–100% scale (so cards compare honestly). Neutral ink: the rate is how often
 * auditors noted the item, not a failure rate. One point (a single quarter in the filter) draws a dot and no
 * slope; no points draws nothing.
 */
export function Sparkline({ points, label }: { points: { label: string; rate: number }[]; label: string }) {
  const pts = points.filter((p) => Number.isFinite(p.rate));
  if (!pts.length) return null;
  const y = (r: number) => PAD + (1 - Math.min(1, Math.max(0, r))) * (H - PAD * 2);
  const x = (i: number) => (pts.length === 1 ? W / 2 : PAD + (i * (W - PAD * 2)) / (pts.length - 1));
  return (
    <figure className="flex w-[112px] shrink-0 flex-col gap-1" aria-label={label} role="img">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden className="overflow-visible">
        <line x1={0} x2={W} y1={H - PAD} y2={H - PAD} stroke="var(--hairline)" strokeWidth={1} />
        {pts.length > 1 && (
          <polyline
            points={pts.map((p, i) => `${x(i)},${y(p.rate)}`).join(' ')}
            fill="none"
            stroke="var(--text)"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {pts.map((p, i) => (
          <circle
            key={p.label}
            cx={x(i)}
            cy={y(p.rate)}
            r={3.5}
            fill={i === pts.length - 1 ? 'var(--text)' : 'var(--surface)'}
            stroke="var(--text)"
            strokeWidth={1.5}
          />
        ))}
      </svg>
      <figcaption className={`num flex text-[11px] text-muted ${pts.length === 1 ? 'justify-center' : 'justify-between'}`}>
        {pts.map((p) => (
          <span key={p.label}>
            {p.label} <span className="font-semibold text-ink">{pct(p.rate)}%</span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
