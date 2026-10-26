import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface Crumb { label: string; href?: string }

/** Path back up the drill: every ancestor is a link, the current page is plain text. */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" data-testid="breadcrumb" className="min-w-0">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 text-[14px]">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1">
              {c.href && !last ? (
                <Link
                  href={c.href}
                  className="max-w-[28ch] truncate rounded-md px-1 py-0.5 text-muted transition-colors hover:bg-fill-2 hover:text-ink"
                >
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page" className="max-w-[36ch] truncate px-1 py-0.5 font-semibold text-ink">
                  {c.label}
                </span>
              )}
              {!last && <ChevronRight size={14} strokeWidth={2.4} className="shrink-0 text-faint" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
