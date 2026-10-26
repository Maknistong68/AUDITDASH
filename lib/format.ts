import type { Band } from './types';

/** 0.6665 -> "67". Non-finite -> "—" (never NaN on screen). */
export const pct = (x: number | null | undefined): string =>
  x === null || x === undefined || !Number.isFinite(x) ? '—' : String(Math.round(x * 100));

/** Signed change in whole percentage points (the one trend precision everywhere): 0.0097 -> "+1", -0.031 -> "−3". */
export const pts = (d: number): string => {
  const n = Math.round(d * 100);
  return `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n)}`;
};

export const int = (n: number): string => Math.round(n).toLocaleString('en-US');

const BAND_VAR: Record<Band, string> = {
  Excellent: 'var(--band-excellent)',
  Good: 'var(--band-good)',
  'Partially Compliant': 'var(--band-partial)',
  'Minimally Compliant': 'var(--band-minimal)',
  'Non-Compliant': 'var(--band-non)',
};
export const bandColor = (b: Band): string => BAND_VAR[b];
