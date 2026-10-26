/**
 * Short plain-language labels (2–6 words, ≤ 40 chars) for every H&S checklist item, for the main dashboard where a
 * director must read a line in two seconds. Codes and the full audit questions stay on the detail pages.
 * Unknown codes fall back to the question, trimmed to a short phrase.
 */
const LABELS: Record<string, string> = {
  A1: 'HSSE strategic plan & targets',
  A2: 'HSSE execution plan',
  A3: 'Mandatory training tracking',
  A4: 'Audit & inspection schedule',
  A5: 'HSSE data & reporting',
  A6: 'Enablon system use & review',
  A7: 'Incident investigation & lessons',
  A8: 'HSSE alerts & campaigns',
  A9: 'Contractor HSSE meetings',
  A10: 'Non-conformity escalation',
  A11: 'Reward & consequence process',
  A12: 'Monthly HSSE leadership meetings',
  A13: 'Work order start-up & close-out',
  A14: 'Quarterly performance review',
  A15: 'Leadership safety tours',
  'B1.1': 'Risk assessments for current tasks',
  'B1.2': 'Daily pre-start briefings',
  'B2.1': 'Adequate supervision at work',
  'B2.2': 'Competent persons designated',
  'B2.3': 'Competent persons for risky work',
  'B2.4': 'Competent persons present at work',
  'B3.1': 'Emergency response plan',
  'B3.2': 'Emergency plan awareness',
  'B3.3': 'Emergency drills planned & held',
  'B4.1': 'Permit to work system',
  'B4.2': 'Permit close-out checks',
  'B5.1': 'Underground utility detection',
  'B5.2': 'Utility clearance linked to permits',
  'B5.3': 'Utility clearance for all digging',
  'B6.1': 'Subcontractor screening & evaluation',
  'B6.2': 'Subcontractor pre-start safety check',
  'B6.3': 'Subcontractor past safety record',
  'B6.4': 'Subcontractor supervision arrangements',
  'B6.5': 'Subcontractor performance tracking',
  'B6.6': 'Subcontractor improvement actions',
  'B6.7': 'Electrician competency checks',
  'B6.8': 'Electrical equipment register',
  'B6.9': 'Subcontractor safety meetings',
  'B7.1': 'HSE training records',
  'B7.2': 'Safety induction for all staff',
  'B8.1': 'Incident reporting awareness',
  'B9.1': 'Fire equipment & inspections',
  'B9.2': 'Gas cutting equipment set-up',
  'B9.3': 'Flammable materials storage',
  'B10.1': 'PPE policy in practice',
  'B10.2': 'Task-specific PPE',
  'B11.1': 'Medical facility & ambulance',
  'B11.2': 'Qualified medical staff',
  'B11.3': 'First aiders on site',
  'B12.1': 'Occupational health program',
  'B12.2': 'Health surveillance',
  'C1.1': 'H&S steering committee',
  'C1.2': 'Actions from senior management walks',
  'C1.3': 'Steering committee minutes',
  'C1.4': 'Audit reports reviewed by management',
  'C1.5': 'Senior management walk schedule',
  'C1.6': 'Corrective actions from audits',
  'C1.7': 'Mass toolbox talks with leaders',
  'C1.8': 'Near-miss reporting rewards',
  'C1.9': 'Risk assessments approved & briefed',
  'C1.10': 'Risk assessments available on site',
  'C1.11': 'Risk assessments match the work',
  'C1.12': 'Risk assessment review & sign-off',
  'C2.2': 'Approved HSSE plan',
  'C2.3': 'Approved monitoring schedule',
  'C2.4': 'Approved training matrix',
  'C2.5': 'Approved HSSE staff CVs',
  'C2.6': 'Approved reward scheme',
  'C2.7': 'Approved emergency management plan',
  'C2.8': 'Approved injury management plan',
  'C2.9': 'Approved subcontractor plan',
  'C2.10': 'Approved traffic plan',
  'C2.11': 'Approved lifting plan',
  'C2.12': 'Approved fatigue plan',
  'C2.13': 'Approved fire prevention plan',
  'C2.14': 'Approved electrical safety plan',
  'C2.15': 'Approved commissioning plans',
  'C2.16': 'Approved temporary works plan',
  'C2.17': 'Approved bad-weather working plan',
  'C2.18': 'Approved equipment inspection program',
  'C2.19': 'Approved mobilisation plan',
};

export const ITEM_LABELS: Readonly<Record<string, string>> = LABELS;

/** Fallback: the question's first clause, without the leading "Is there / Are …", cut to ≤ 40 chars on a word. */
export function trimQuestion(question: string, max = 40): string {
  let s = question.split(/[?(]/)[0].trim();
  s = s.replace(/^(is there|are there|are|is|does|do|has|have|was|were|how is|how are|how does)\s+(an?\s+|the\s+)?/i, '');
  s = s.charAt(0).toUpperCase() + s.slice(1);
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 1)).replace(/[,;:&-]+$/, '').trim()}…`;
}

export function itemLabel(code: string, question = ''): string {
  return LABELS[code] ?? (question ? trimQuestion(question) : code);
}
