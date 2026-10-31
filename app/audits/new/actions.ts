'use server';

import { currentUser, hasRole } from '@/lib/auth';
import { AUDIT_TYPES } from '@/lib/auditTypeIds';
import type { AuditDraft } from '@/lib/input/model';
import { supabaseOn } from '@/lib/supabase/env';
import { createServerSupabase } from '@/lib/supabase/server';

export type SubmitResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * File an audit from the wizard: one row in public.submissions, for a lead to review and import. Row-level
 * security also requires the auditor role and stamps the submitter; the content cannot be edited afterwards.
 */
export async function submitAudit(draft: AuditDraft): Promise<SubmitResult> {
  if (!supabaseOn()) return { ok: false, error: 'There is no server to file to here: use Download and send the file.' };
  const me = await currentUser();
  if (!hasRole(me, 'auditor')) return { ok: false, error: 'This account cannot file audits: it needs the auditor role.' };
  if (!draft || typeof draft !== 'object' || !AUDIT_TYPES.some((t) => t.id === draft.type) || typeof draft.answers !== 'object' || !Array.isArray(draft.notes)) {
    return { ok: false, error: 'The audit could not be read. Save a draft and try again.' };
  }
  if (JSON.stringify(draft).length > 2_000_000) return { ok: false, error: 'The audit is too large to file. Remove very long notes and try again.' };
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('submissions')
    .insert({ contractor_id: draft.details.contractorId, audit_type: draft.type, doc: { ...draft, status: 'submitted' } })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: `The audit was not filed (${error?.message ?? 'no id returned'}). Save a draft and try again.` };
  return { ok: true, id: data.id };
}
