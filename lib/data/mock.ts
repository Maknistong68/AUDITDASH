import checklistSeed from '../../data/seed/checklist.json';
import contractorsSeed from '../../data/seed/contractors.json';
import auditsSeed from '../../data/seed/audits.json';
import observationsSeed from '../../data/seed/observations.json';
import type { Audit, ChecklistItem, Contractor, Observation } from '../types';
import type { Repo } from './repo';

const checklist = checklistSeed as ChecklistItem[];
const contractors = contractorsSeed as Contractor[];
const audits = auditsSeed as Audit[];
const observations = observationsSeed as Observation[];

export const mockRepo: Repo = {
  checklist: () => checklist,
  contractors: () => contractors,
  audits: () => audits,
  observations: () => observations,
};
