import { TopBar } from '@/components/shell/TopBar';
import { Breadcrumb, type Crumb } from '@/components/shell/Breadcrumb';
import { EscToParent } from '@/components/shell/EscToParent';
import type { Filter } from '@/lib/types';

/**
 * Shell of every details page: the top bar (filters stay), the breadcrumb, Esc → parent.
 * Children own their horizontal gutters (carousels run full-bleed so neighbours can peek).
 */
export function DetailFrame({ filter, crumbs, parent, children }: { filter: Filter; crumbs: Crumb[]; parent: string; children: React.ReactNode }) {
  return (
    <>
      <TopBar filter={filter} detail />
      <EscToParent href={parent} />
      <main data-testid="details" className="flex flex-col pb-[clamp(28px,5svh,64px)] pt-[clamp(8px,1.4svh,18px)]">
        <div className="px-[var(--gutter)] pb-[clamp(6px,1svh,12px)]">
          <Breadcrumb items={crumbs} />
        </div>
        {children}
      </main>
    </>
  );
}

/** Page title: the h1 and one quiet line of facts. */
export function PageTitle({ children, meta, lead }: { children: React.ReactNode; meta?: React.ReactNode; lead?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-[clamp(10px,1vw,16px)]">
      {lead}
      <div className="min-w-0">
        <h1 className="text-[24px] min-[900px]:text-[clamp(24px,3.6svh,32px)] font-semibold leading-[1.05] tracking-[-0.035em]">{children}</h1>
        {meta && <p className="mt-1 text-[clamp(13px,1.6svh,15px)] text-muted">{meta}</p>}
      </div>
    </div>
  );
}

/** One section of a slide or page that has nothing to show. */
export function DetailEmpty({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <section data-testid="empty-state" className="card mx-[var(--gutter)] flex flex-col items-center justify-center gap-5 px-6 py-[clamp(40px,10svh,120px)] text-center">
      <p className="figure text-[clamp(72px,12svh,128px)] text-faint" aria-hidden>0</p>
      <h2 className="text-[21px] font-semibold tracking-[-0.02em]">{title}</h2>
      {action}
    </section>
  );
}
