import type { Band, Quarter } from './types';
import { QUARTERS } from './filters';

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

export type BandTone = 'good' | 'partial' | 'minimal' | 'non';
const TONE: Record<Band, BandTone> = {
  Excellent: 'good',
  Good: 'good',
  'Partially Compliant': 'partial',
  'Minimally Compliant': 'minimal',
  'Non-Compliant': 'non',
};
/** Status tone for a band. Only Good/Excellent are ever green. */
export const bandTone = (b: Band): BandTone => TONE[b];

const SHORT: Record<Band, string> = {
  Excellent: 'Excellent',
  Good: 'Good',
  'Partially Compliant': 'Partial',
  'Minimally Compliant': 'Minimal',
  'Non-Compliant': 'Non-compliant',
};
export const bandShort = (b: Band): string => SHORT[b];

/** Change in whole points between two scores as displayed (round each, then subtract). Null when no previous. */
export function deltaPoints(total: number, previous: number | null): number | null {
  if (previous === null || !Number.isFinite(previous) || !Number.isFinite(total)) return null;
  return Math.round(total * 100) - Math.round(previous * 100);
}

/** "Q4" for an audit id in Q1-2026 (`<contractNo>-<quarter>-<yyyymmdd>`); null for the first quarter. */
export function prevQuarterShort(auditId: string): string | null {
  const m = /-(Q\d-\d{4})-/.exec(auditId);
  const i = m ? QUARTERS.indexOf(m[1] as Quarter) : -1;
  return i > 0 ? QUARTERS[i - 1].slice(0, 2) : null;
}
