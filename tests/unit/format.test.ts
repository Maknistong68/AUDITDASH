import { describe, expect, it } from 'vitest';
import { bandColor, bandShort, bandTone, deltaPoints, int, pct, prevQuarterShort, pts, dateLabel, quarterLabel } from '@/lib/format';

describe('format', () => {
  it('pct rounds and never prints NaN', () => {
    expect(pct(0.6665)).toBe('67');
    expect(pct(null)).toBe('—');
    expect(pct(Number.NaN)).toBe('—');
    expect(pct(Infinity)).toBe('—');
  });
  it('pts signs whole percentage-point changes', () => {
    expect(pts(0.0097)).toBe('+1');
    expect(pts(-0.031)).toBe('−3');
    expect(pts(0.004)).toBe('±0');
    expect(pts(0)).toBe('±0');
  });
  it('int adds separators', () => expect(int(1322)).toBe('1,322'));
  it('bandColor maps every band to a token', () => {
    expect(bandColor('Excellent')).toBe('var(--band-excellent)');
    expect(bandColor('Non-Compliant')).toBe('var(--band-non)');
  });
});

describe('scoreboard format', () => {
  it('bandTone is semantically honest: only Good/Excellent are good', () => {
    expect(bandTone('Excellent')).toBe('good');
    expect(bandTone('Good')).toBe('good');
    expect(bandTone('Partially Compliant')).toBe('partial');
    expect(bandTone('Minimally Compliant')).toBe('minimal');
    expect(bandTone('Non-Compliant')).toBe('non');
  });
  it('bandShort', () => {
    expect(bandShort('Minimally Compliant')).toBe('Minimal');
    expect(bandShort('Non-Compliant')).toBe('Non-compliant');
  });
  it('deltaPoints is the difference of the displayed whole percentages; null without previous', () => {
    expect(deltaPoints(0.85, 0.74)).toBe(11);
    expect(deltaPoints(0.6, 0.620940170940171)).toBe(-2);
    expect(deltaPoints(0.6, null)).toBeNull();
    expect(deltaPoints(0.6, Number.NaN)).toBeNull();
  });
  it('prevQuarterShort names the quarter before an audit id quarter', () => {
    expect(prevQuarterShort('4800001131-Q1-2026-20260210')).toBe('Q4');
    expect(prevQuarterShort('4800001131-Q4-2025-20251110')).toBeNull();
  });
});

describe('dateLabel / quarterLabel', () => {
  it('formats ISO dates without time zones', () => {
    expect(dateLabel('2026-03-01')).toBe('1 Mar 2026');
    expect(dateLabel('2025-11-19', false)).toBe('19 Nov');
    expect(dateLabel('bad')).toBe('bad');
  });
  it('labels quarters', () => expect(quarterLabel('Q4-2025')).toBe('Q4 2025'));
});
