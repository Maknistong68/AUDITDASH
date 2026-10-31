import { cache } from 'react';
import { createServerSupabase } from '@/lib/supabase/server';
import type { Audit, ChecklistItem, Contractor, Observation } from '../types';
import type { Repo } from './repo';

const PAGE = 1000;

/** Every `doc` of a table in file order, as the signed-in user (PostgREST returns at most 1000 rows per request). */
async function docs<T>(table: string): Promise<T[]> {
  const supabase = await createServerSupabase();
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('doc').order('position').range(from, from + PAGE - 1);
    if (error) throw new Error(`Supabase ${table}: ${error.message}`);
    out.push(...(data ?? []).map((r) => r.doc as T));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/**
 * The whole dataset, read once per request through the user's own session (so row-level security applies and the
 * app holds no secret). The dashboard computes every figure over all audits, hence all rows.
 */
const fetchAll = cache(async () => {
  const [checklist, contractors, audits, observations] = await Promise.all([
    docs<ChecklistItem>('checklist_items'),
    docs<Contractor>('contractors'),
    docs<Audit>('audits'),
    docs<Observation>('observations'),
  ]);
  return { checklist, contractors, audits, observations };
});

export async function supabaseRepo(): Promise<Repo> {
  const d = await fetchAll();
  return { checklist: () => d.checklist, contractors: () => d.contractors, audits: () => d.audits, observations: () => d.observations };
}
