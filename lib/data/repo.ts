import type { Audit, ChecklistItem, Contractor, Observation } from '../types';
import { requireRole } from '../auth';
import { supabaseOn } from '../supabase/env';
import { mockRepo } from './mock';

export interface Repo {
  checklist(): ChecklistItem[];
  contractors(): Contractor[];
  audits(): Audit[];
  observations(): Observation[];
}

/**
 * The data every page reads. Seed JSON (data/seed) unless DATA_SOURCE=supabase, where the caller must be signed in
 * with a role (viewer or above) and the data comes from the Supabase tables the importer fills.
 */
export async function getRepo(): Promise<Repo> {
  if (supabaseOn()) {
    await requireRole('viewer');
    const { supabaseRepo } = await import('./supabase');
    return supabaseRepo();
  }
  return mockRepo;
}
