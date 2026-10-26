import { Camera, ThumbsUp } from 'lucide-react';
import { CATEGORY_ICONS } from '@/components/charts/categoryIcons';
import { CodeChip } from '@/components/details/parts';
import type { Category, Observation } from '@/lib/types';

/**
 * One observation in full: item code chip (or the Site tag), the auditor's text with its line breaks kept,
 * and a camera icon when the report has a photo. Long text is allowed here (the report is the long-form level).
 */
export function Entry({ o, question }: { o: Observation; question?: string }) {
  return (
    <li
      data-testid="report-entry"
      data-kind={o.kind}
      data-category={o.category ?? undefined}
      className="grid break-inside-avoid grid-cols-[3.6em_minmax(0,1fr)_18px] items-start gap-3 py-[clamp(9px,1.3svh,13px)] print:py-2"
    >
      <span className="flex flex-col items-stretch gap-1 pt-[2px]">
        {o.kind === 'positive' ? (
          <ThumbsUp size={15} strokeWidth={2.4} className="mx-auto mt-[2px] text-[var(--good-dot)]" aria-label="Positive observation" />
        ) : (
          <>
            {o.itemCode && (
              <span title={question}>
                <CodeChip code={o.itemCode} className="w-full" />
              </span>
            )}
            {o.kind === 'site' && (
              <span data-testid="site-tag" className="rounded-md bg-fill-2 px-1.5 py-[1px] text-center text-[12px] font-semibold text-muted">Site</span>
            )}
          </>
        )}
      </span>
      <p className="whitespace-pre-line break-words text-[15px] leading-[1.55] [overflow-wrap:anywhere]">{o.text}</p>
      <span className="pt-[3px] text-faint">
        {o.hasPhoto && (
          <span title="Photo in the audit report">
            <Camera size={16} strokeWidth={2} aria-hidden />
            <span className="sr-only">Photo attached</span>
          </span>
        )}
      </span>
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
