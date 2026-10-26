import type { Audit, ChecklistItem, Contractor, Observation } from '../types';
import { mockRepo } from './mock';

export interface Repo {
  checklist(): ChecklistItem[];
  contractors(): Contractor[];
  audits(): Audit[];
  observations(): Observation[];
}

/** Mock (seed JSON) unless DATA_SOURCE=supabase, which is not implemented in this plan. */
export function getRepo(): Repo {
  if (process.env.DATA_SOURCE === 'supabase') {
    throw new Error('DATA_SOURCE=supabase not implemented yet');
  }
  return mockRepo;
}
