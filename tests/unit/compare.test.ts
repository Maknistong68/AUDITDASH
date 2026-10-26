import { describe, expect, it } from 'vitest';
import { MAX_COMPARE, parseCompare, toggleCompare, withCompare, bestWorst } from '@/lib/compare';

describe('parseCompare', () => {
  const valid = ['a', 'b', 'c', 'd'];
  it('keeps valid ids in order, dedupes and caps at 3', () => {
    expect(parseCompare('b,a,b,x,c,d', valid)).toEqual(['b', 'a', 'c']);
    expect(MAX_COMPARE).toBe(3);
  });
  it('handles null, empty and whitespace', () => {
    expect(parseCompare(null, valid)).toEqual([]);
    expect(parseCompare('', valid)).toEqual([]);
    expect(parseCompare(' a , d ', valid)).toEqual(['a', 'd']);
  });
});

describe('toggleCompare', () => {
  it('adds, removes, and refuses a 4th', () => {
    expect(toggleCompare([], 'a')).toEqual(['a']);
    expect(toggleCompare(['a', 'b'], 'a')).toEqual(['b']);
    expect(toggleCompare(['a', 'b', 'c'], 'd')).toEqual(['a', 'b', 'c']);
  });
});

describe('withCompare', () => {
  it('sets c and keeps other params; removes c when empty', () => {
    expect(withCompare('?q=all&r=SR1,SR2', ['a', 'b'])).toBe('?q=all&r=SR1%2CSR2&c=a%2Cb');
    expect(withCompare('?q=all&c=a,b', [])).toBe('?q=all');
    expect(withCompare('', [])).toBe('');
  });
});

describe('bestWorst', () => {
  it('marks lowest gap best and highest worst, ignoring nulls; no marks when all equal or < 2 values', () => {
    expect(bestWorst([0.2, 0.5, null])).toEqual({ best: [0], worst: [1] });
    expect(bestWorst([0.3, 0.3])).toEqual({ best: [], worst: [] });
    expect(bestWorst([0.3, null])).toEqual({ best: [], worst: [] });
  });
  it('compares at displayed precision and marks every tied entry', () => {
    expect(bestWorst([0.1944, 0.1944, 0.5])).toEqual({ best: [0, 1], worst: [2] });
    expect(bestWorst([0.3333, 0.3324, 0.2])).toEqual({ best: [2], worst: [0, 1] });
    expect(bestWorst([0.3333, 0.3324])).toEqual({ best: [], worst: [] });
  });
});
