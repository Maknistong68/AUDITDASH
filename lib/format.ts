import type { Band } from './types';

/** 0.6665 -> "67". Non-finite -> "—" (never NaN on screen). */
export const pct = (x: number | null | undefined): string =>
  x === null || x === undefined || !Number.isFinite(x) ? '—' : String(Math.round(x * 100));

/** Signed percentage-point change, one decimal: 0.0097 -> "+1.0". */
export const pts = (d: number): string => `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d * 100).toFixed(1)}`;

export const int = (n: number): string => Math.round(n).toLocaleString('en-US');

const BAND_VAR: Record<Band, string> = {
  Excellent: 'var(--band-excellent)',
  Good: 'var(--band-good)',
  'Partially Compliant': 'var(--band-partial)',
  'Minimally Compliant': 'var(--band-minimal)',
  'Non-Compliant': 'var(--band-non)',
};
export const bandColor = (b: Band): string => BAND_VAR[b];
