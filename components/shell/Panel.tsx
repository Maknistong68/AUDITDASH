/** A titled hero panel that never grows past its grid cell. */
export function Panel({ title, meta, children, className = '' }: { title: string; meta?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`panel flex min-h-0 min-w-0 flex-col gap-3 p-5 ${className}`} aria-label={title}>
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-[16px] font-semibold leading-6">{title}</h2>
        {meta && <span className="text-[12px] text-muted">{meta}</span>}
      </header>
      {children}
    </section>
  );
}
