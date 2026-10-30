import { CATEGORY_ICONS } from '@/components/charts/categoryIcons';
import { itemLabel } from '@/lib/itemLabels';
import type { Category, Observation } from '@/lib/types';

/**
 * One observation in full: the question it was noted on (its plain label, never the code; "Site" for a site finding),
 * then the auditor's text with its line breaks kept. Long text is allowed here (the report is the long-form level).
 */
export function Entry({ o, question }: { o: Observation; question?: string }) {
  const label = o.itemCode && question ? itemLabel(o.itemCode, question) : o.kind === 'site' ? 'Site' : null;
  return (
    <li
      data-testid="report-entry"
      data-kind={o.kind}
      data-category={o.category ?? undefined}
      className="flex break-inside-avoid flex-col gap-1 py-[clamp(9px,1.3svh,13px)] print:py-2"
    >
      {label && (
        <span data-testid={o.kind === 'site' ? 'site-tag' : 'entry-question'} className="text-[13px] font-semibold text-muted" title={question}>
          {label}
        </span>
      )}
      <p className="whitespace-pre-line break-words text-[15px] leading-[1.55] [overflow-wrap:anywhere]">{o.text}</p>
    </li>
  );
}

/** A category's negative observations and site findings, under its icon, name and count. */
export function CategoryGroup({
  c, entries, questions, hidden,
}: { c: Category; entries: Observation[]; questions: Map<string, string>; hidden: boolean }) {
  const Icon = CATEGORY_ICONS[c.icon];
  return (
    <section
      data-testid="report-group"
      data-category={c.id}
      className={`mb-[clamp(16px,2.4svh,28px)] break-inside-avoid print:break-inside-auto ${hidden ? 'hidden print:block' : ''}`}
    >
      <h3 className="flex break-after-avoid items-center gap-2 pb-1 text-[16px] font-semibold tracking-[-0.01em]">
        {Icon && <Icon size={16} strokeWidth={2.4} style={{ color: c.color }} aria-hidden />}
        <span className="min-w-0">{c.name}</span>
        <span className="num text-faint">{entries.length}</span>
      </h3>
      <ul>
        {entries.map((o) => <Entry key={o.id} o={o} question={o.itemCode ? questions.get(o.itemCode) : undefined} />)}
      </ul>
    </section>
  );
}
