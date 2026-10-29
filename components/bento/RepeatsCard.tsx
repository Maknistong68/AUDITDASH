/** The repeat-findings wording shared by the /repeats header (the dashboard card was replaced by the director tiles). */

/** The rule in a few words, beside the figure. Card and /repeats header. */
export function RepeatRule() {
  return <span data-testid="repeats-rule">questions noted again in the next audit</span>;
}

/** "75 questions · 7 contractors": what the repeat count is made of (the /repeats heat map's rows and columns). */
export function RepeatStats({ questions, contractors }: { questions: number; contractors: number }) {
  const stat = (n: number, one: string, many: string, id: string) => (
    <span data-testid={id} className="whitespace-nowrap">
      <span className="num font-semibold text-ink">{n}</span> {n === 1 ? one : many}
    </span>
  );
  return (
    <p data-testid="repeats-stats" className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px] leading-tight text-muted">
      {stat(questions, 'question', 'questions', 'repeats-questions')}
      <span aria-hidden>·</span>
      {stat(contractors, 'contractor', 'contractors', 'repeats-contractors')}
    </p>
  );
}
