import { describe, expect, it } from 'vitest';
import { mockRepo } from '@/lib/data/mock';
import { auditReport, isNaObservation } from '@/lib/analytics';

const repo = mockRepo;
const audit = (id: string) => repo.audits().find((a) => a.id === id)!;

describe('auditReport', () => {
  it('lists the report sections in order with N/A as null', () => {
    const r = auditReport(repo, audit('4800001272-Q4-2025-20251029'));
    expect(r.sections.map((s) => s.code)).toEqual(['A', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'C1', 'C2']);
    expect(r.sections[0]).toMatchObject({ label: 'Management', possible: 45, scored: 30 });
    for (const s of r.sections) expect(s.ratio === null ? s.possible === 0 : Number.isFinite(s.ratio)).toBe(true);
  });
  it('splits observations: 14 positives; negatives include site findings and never N/A notes', () => {
    const r = auditReport(repo, audit('4800001272-Q4-2025-20251029'));
    expect(r.positives).toHaveLength(14);
    expect(r.negatives.some((o) => o.kind === 'site')).toBe(true);
    expect(r.negatives.every((o) => o.kind !== 'positive' && o.category !== null)).toBe(true);
    for (const a of repo.audits()) for (const o of auditReport(repo, a).negatives) expect(isNaObservation(repo, o)).toBe(false);
  });
  it('finds the previous audit of the contractor, or null for the first', () => {
    expect(auditReport(repo, audit('4800001131-Q1-2026-20260301')).previous?.id).toBe('4800001131-Q4-2025-20251103');
    expect(auditReport(repo, audit('4800001131-Q4-2025-20251103')).previous).toBeNull();
  });
});
