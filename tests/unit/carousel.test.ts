import { describe, expect, it } from 'vitest';
import { parseSlide, snapIndex, withSlide } from '@/lib/carousel';

describe('parseSlide', () => {
  it('defaults to 0 and clamps to the last slide', () => {
    expect(parseSlide(undefined, 3)).toBe(0);
    expect(parseSlide('1', 3)).toBe(1);
    expect(parseSlide('9', 3)).toBe(2);
    expect(parseSlide('-1', 3)).toBe(0);
    expect(parseSlide('x', 3)).toBe(0);
    expect(parseSlide(['2', '0'], 3)).toBe(2);
    expect(parseSlide('1', 0)).toBe(0);
  });
});

describe('snapIndex', () => {
  it('stays put on a short slow drag', () => expect(snapIndex(0, 3, -30, 0, 1000)).toBe(0));
  it('drag left past the threshold goes to the older slide', () => expect(snapIndex(0, 3, -300, 0, 1000)).toBe(1));
  it('drag right goes to the newer slide', () => expect(snapIndex(1, 3, 300, 0, 1000)).toBe(0));
  it('a flick counts', () => expect(snapIndex(1, 3, -20, -900, 1000)).toBe(2));
  it('never leaves the range', () => {
    expect(snapIndex(0, 3, 400, 0, 1000)).toBe(0);
    expect(snapIndex(2, 3, -400, 0, 1000)).toBe(2);
  });
});

describe('withSlide', () => {
  it('sets s and keeps other params', () => expect(withSlide('?q=all&r=SR1%2CSR2', 1)).toBe('?q=all&r=SR1%2CSR2&s=1'));
  it('drops s for slide 0', () => expect(withSlide('?q=all&s=2', 0)).toBe('?q=all'));
  it('handles an empty search', () => { expect(withSlide('', 0)).toBe(''); expect(withSlide('', 2)).toBe('?s=2'); });
});
