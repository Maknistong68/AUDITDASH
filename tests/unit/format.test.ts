import { describe, expect, it } from 'vitest';
import { bandColor, int, pct, pts } from '@/lib/format';

describe('format', () => {
  it('pct rounds and never prints NaN', () => {
    expect(pct(0.6665)).toBe('67');
    expect(pct(null)).toBe('—');
    expect(pct(Number.NaN)).toBe('—');
    expect(pct(Infinity)).toBe('—');
  });
  it('pts signs percentage-point changes', () => {
    expect(pts(0.0097)).toBe('+1.0');
    expect(pts(-0.031)).toBe('−3.1');
    expect(pts(0)).toBe('±0.0');
  });
  it('int adds separators', () => expect(int(1322)).toBe('1,322'));
  it('bandColor maps every band to a token', () => {
    expect(bandColor('Excellent')).toBe('var(--band-excellent)');
    expect(bandColor('Non-Compliant')).toBe('var(--band-non)');
  });
});
