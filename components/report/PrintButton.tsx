'use client';

/** Opens the browser's print dialog (the print stylesheet lays the report out on white). */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-fill px-4 text-[14px] font-semibold text-ink transition-[background-color,scale] hover:bg-fill-2 active:scale-[0.97] print:hidden"
    > Print
    </button>
  );
}
