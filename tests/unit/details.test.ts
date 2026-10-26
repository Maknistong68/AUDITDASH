import { describe, expect, it } from 'vitest';
import { detailContext, href, toSearchParams } from '@/lib/details';

describe('details helpers', () => {
  it('reads the filter and the slide', () => {
    const c = detailContext({ q: 'Q1-2026', r: 'SR1', s: '1' });
    expect(c.filter).toEqual({ quarter: 'Q1-2026', regions: ['SR1'] });
    expect(c.query).toBe('q=Q1-2026&r=SR1');
    expect(c.s).toBe('1');
  });
  it('takes the first of repeated params', () => expect(toSearchParams({ q: ['all', 'x'] }).get('q')).toBe('all'));
  it('builds links that keep the filter', () => {
    expect(href('/category/documents', 'q=all&r=SR1')).toBe('/category/documents?q=all&r=SR1');
    expect(href('/x', 'q=all', { s: 2, hash: 'item-B6.1' })).toBe('/x?q=all&s=2#item-B6.1');
    expect(href('/x', 'q=all', { s: 0 })).toBe('/x?q=all');
    expect(href('/x', 'q=Q4-2025&r=SR1', { s: 0 })).toBe('/x?q=Q4-2025&r=SR1&s=0');
    expect(href('/x', 'q=Q4-2025&r=SR1')).toBe('/x?q=Q4-2025&r=SR1');
  });
});

describe('audit type', () => {
  it('keeps the audit type in the query and in links', () => {
    const c = detailContext({ q: 'Q1-2026', r: 'SR1', t: 'welfare' });
    expect(c.filter).toEqual({ quarter: 'Q1-2026', regions: ['SR1'], type: 'welfare' });
    expect(c.query).toBe('q=Q1-2026&r=SR1&t=welfare');
    expect(href('/category/documents', c.query, { s: 1 })).toBe('/category/documents?q=Q1-2026&r=SR1&t=welfare&s=1');
  });
});
