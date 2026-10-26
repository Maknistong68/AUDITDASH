'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { CATEGORY_ICONS } from '@/components/charts/categoryIcons';

export interface FindingGroup {
  category: string;
  name: string;
  icon: string;
  color: string;
  findings: { id: string; code: string | null; text: string; href: string | null }[];
}

const CAP = 3;

function Group({ g, auditId }: { g: FindingGroup; auditId: string }) {
  const [open, setOpen] = useState(false);
  const Icon = CATEGORY_ICONS[g.icon];
  const shown = open ? g.findings : g.findings.slice(0, CAP);
  // unique per audit: every carousel slide renders its own groups
  const listId = `findings-${auditId}-${g.category}`;
  return (
    <section data-testid="finding-group" data-category={g.category} className="mb-[clamp(14px,2.2svh,26px)] break-inside-avoid">
      <h4 className="flex items-center gap-2 pb-1.5 text-[15px] font-semibold tracking-[-0.01em]">
        {Icon && <Icon size={15} strokeWidth={2.4} style={{ color: g.color }} aria-hidden />}
        <span className="min-w-0 truncate">{g.name}</span>
        <span className="num font-semibold text-faint">{g.findings.length}</span>
      </h4>
      <ul id={listId} className="grid gap-0.5">
        {shown.map((f) => {
          const body = (
            <>
              {f.code ? (
                <span className="num rounded-md bg-fill px-1.5 py-[1px] text-center text-[12px] font-semibold text-muted">{f.code}</span>
              ) : (
                <span className="rounded-md bg-fill-2 px-1.5 py-[1px] text-center text-[12px] text-muted">Site</span>
              )}
              <span className="line-clamp-2 whitespace-pre-line break-words text-[14px] leading-snug">{f.text}</span>
            </>
          );
          const cls = 'grid grid-cols-[3.4em_minmax(0,1fr)] items-baseline gap-2.5 rounded-[10px] px-2 py-1.5';
          return (
            <li key={f.id} data-testid="finding">
              {f.href ? (
                <Link href={f.href} className={`${cls} transition-colors hover:bg-fill-2`}>{body}</Link>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      {g.findings.length > CAP && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((o) => !o)}
          className="ml-2 mt-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[13px] font-semibold text-[var(--accent)] transition-colors hover:bg-fill-2"
        >
          {open ? 'Show fewer' : `Show all ${g.findings.length}`}
          <ChevronDown size={14} strokeWidth={2.6} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
      )}
    </section>
  );
}

/** Findings of one audit grouped by category: three per category, then "Show all". */
export function FindingGroups({ groups, auditId }: { groups: FindingGroup[]; auditId: string }) {
  return (
    <div className="columns-1 gap-[clamp(20px,2.4vw,44px)] min-[900px]:columns-2 min-[1500px]:columns-3">
      {groups.map((g) => <Group key={g.category} g={g} auditId={auditId} />)}
    </div>
  );
}
