import type { AuditType } from './types';

/**
 * Audit-type ids and labels only — no checklist JSON, so filters and client components stay small.
 * Checklists, sections and categories per type live in lib/auditTypes.ts (server / wizard code).
 */
export interface AuditTypeInfo { id: AuditType; label: string; short: string }

export const AUDIT_TYPES: AuditTypeInfo[] = [
  { id: 'hs', label: 'Health & Safety', short: 'H&S' },
  { id: 'security', label: 'Security', short: 'Security' },
  { id: 'environmental', label: 'Environmental', short: 'Environmental' },
  { id: 'welfare', label: 'Welfare', short: 'Welfare' },
  { id: 'crc', label: 'CRC', short: 'CRC' },
];

export const AUDIT_TYPE_IDS: AuditType[] = AUDIT_TYPES.map((t) => t.id);

export const isAuditType = (v: unknown): v is AuditType => AUDIT_TYPE_IDS.includes(v as AuditType);

/** Info for a filter's type (absent = H&S). */
export const auditTypeInfo = (t: AuditType | undefined): AuditTypeInfo => AUDIT_TYPES.find((x) => x.id === (t ?? 'hs'))!;
