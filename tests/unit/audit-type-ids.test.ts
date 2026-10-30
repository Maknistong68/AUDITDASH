import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AUDIT_TYPE_IDS, AUDIT_TYPES, auditTypeInfo, isAuditType } from '@/lib/auditTypeIds';
import { AUDIT_TYPES as FULL } from '@/lib/auditTypes';

describe('auditTypeIds', () => {
  it('lists the five types in tab order, same as auditTypes', () => {
    expect(AUDIT_TYPE_IDS).toEqual(['hs', 'security', 'environmental', 'welfare', 'crc']);
    expect(FULL).toBe(AUDIT_TYPES);
    expect(AUDIT_TYPES.map((t) => t.short)).toEqual(['H&S', 'Security', 'Environmental', 'Welfare', 'CRC']);
  });
  it('guards ids and defaults to H&S', () => {
    expect(isAuditType('crc')).toBe(true);
    expect(isAuditType('HS')).toBe(false);
    expect(isAuditType(null)).toBe(false);
    expect(auditTypeInfo(undefined).label).toBe('Health & Safety');
    expect(auditTypeInfo('security').label).toBe('Security');
  });
  it('pulls in no checklist JSON (client bundles stay small)', () => {
    for (const f of ['lib/auditTypeIds.ts', 'lib/filters.ts', 'lib/scoring.ts']) {
      // meta.json (the quarters present, a few bytes) is the one JSON allowed.
      expect(readFileSync(f, 'utf8').replace("'../data/seed/meta.json'", ''), f).not.toMatch(/\.json'|from '\.\/auditTypes'/);
    }
  });
});
