/** Below-the-fold section title: one large Apple-style heading, one short muted line, optional controls. */
export function SectionHead({ id, title, note, children }: { id: string; title: string; note?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="mb-[clamp(16px,2.4svh,28px)] flex items-end justify-between gap-6">
      <div className="flex min-w-0 flex-col gap-1.5">
        <h2 id={id} className="text-[clamp(26px,2.1vw,38px)] font-semibold leading-[1.05] tracking-[-0.03em]">
          {title}
        </h2>
        {note && <p className="text-[15px] text-muted">{note}</p>}
      </div>
      {children}
    </header>
  );
}
