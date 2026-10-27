/** Track heights: `sm` region rows, `md` the /repeats header, `lg` the /audits header. */
const TRACK = {
  sm: 'h-[clamp(7px,1svh,10px)]',
  md: 'h-[clamp(8px,1.1svh,12px)]',
  lg: 'h-[clamp(10px,1.4svh,14px)]',
} as const;

/**
 * One quarter as a horizontal bar row: label · bar on its track · value. Renders three cells of the caller's grid
 * (`grid-cols-[auto_minmax(0,1fr)_auto]`, or more columns when the caller adds cells after it). The bar grows in from the
 * left (`rp-grow`, staggered by `delay` ms). `fraction` is the bar's share of the track (0–1); null draws the empty track.
 * Shared by the /repeats and /audits headers and the /audits region rows.
 */
export function QuarterBar({ label, fraction, hue, delay, value, size = 'lg', barTestid, valueTestid, valueClass }: {
  label: React.ReactNode;
  fraction: number | null;
  hue: string;
  delay: number;
  value: React.ReactNode;
  size?: keyof typeof TRACK;
  barTestid?: string;
  valueTestid?: string;
  /** Type size of the value; defaults to the header size. */
  valueClass?: string;
}) {
  const ok = fraction !== null && Number.isFinite(fraction);
  return (
    <>
      <span className="num whitespace-nowrap text-[12px] leading-none text-muted">{label}</span>
      <span className={`block rounded-full bg-fill-2 ${TRACK[size]}`}>
        {ok && (
          <span
            data-testid={barTestid}
            className="rp-grow block h-full rounded-full"
            style={{ width: `${Math.min(1, Math.max(0, fraction)) * 100}%`, background: hue, ['--d' as string]: `${delay}ms` }}
          />
        )}
      </span>
      <span data-testid={valueTestid} className={`num text-right font-semibold leading-none ${valueClass ?? 'text-[clamp(15px,2svh,20px)]'}`}>
        {value}
      </span>
    </>
  );
}
