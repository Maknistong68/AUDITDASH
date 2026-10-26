import { describe, expect, it } from 'vitest';
import { initialSlide, parseSlide, snapIndex, withSlide } from '@/lib/carousel';

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
  it('keeps s=0 when a quarter filter is set', () => expect(withSlide('?q=Q4-2025&r=SR1&s=1', 0)).toBe('?q=Q4-2025&r=SR1&s=0'));
  it('handles an empty search', () => { expect(withSlide('', 0)).toBe(''); expect(withSlide('', 2)).toBe('?s=2'); });
});

describe('initialSlide', () => {
  const qs = ['Q1-2026', 'Q1-2026', 'Q4-2025'];
  it('opens on the first slide of the filtered quarter when s is absent', () => {
    expect(initialSlide(null, qs, 'Q4-2025')).toBe(2);
    expect(initialSlide(undefined, qs, 'Q1-2026')).toBe(0);
  });
  it('falls back to slide 0 for all quarters or a quarter with no slide', () => {
    expect(initialSlide(null, qs, 'all')).toBe(0);
    expect(initialSlide(null, ['Q1-2026'], 'Q4-2025')).toBe(0);
  });
  it('lets a valid s win', () => {
    expect(initialSlide('1', qs, 'Q4-2025')).toBe(1);
    expect(initialSlide('0', qs, 'Q4-2025')).toBe(0);
    expect(initialSlide('9', qs, 'Q4-2025')).toBe(2);
  });
});
