import { QUARTERS } from './filters';
import type { Quarter } from './types';

/**
 * Per-quarter rate for a sparkline: hits ÷ that quarter's audit count, oldest first. Quarters with no audits
 * in the filter are dropped, so a single quarter gives one point (no slope) and nothing divides by zero.
 */
export function sparkRates(hits: Record<Quarter, number>, audits: Record<Quarter, number>): { quarter: Quarter; rate: number }[] {
  return QUARTERS.filter((q) => audits[q] > 0).map((q) => ({ quarter: q, rate: hits[q] / audits[q] }));
}
