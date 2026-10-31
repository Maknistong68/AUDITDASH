'use client';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { calm, QUICK } from '@/lib/motion';

export const STEPS = [
  { label: 'Start', short: 'Start' },
  { label: 'Audit details', short: 'Details' },
  { label: 'Checklist', short: 'Checklist' },
  { label: 'Observations & review', short: 'Review' },
] as const;

/** The four steps as dots on a line that fills as the auditor moves on; visited steps are links once an audit is open. */
export function Stepper({ step, enabled, onGo }: { step: number; enabled: boolean; onGo: (n: number) => void }) {
  const frac = step / (STEPS.length - 1);
  return (
    <nav aria-label="Steps" data-testid="wizard-steps" className="pt-[clamp(8px,2svh,24px)]">
      <ol className="relative grid grid-cols-4">
        <span aria-hidden className="absolute left-[12.5%] right-[12.5%] top-[15px] h-[2px] rounded-full bg-fill" />
        <motion.span
          aria-hidden
          className="absolute left-[12.5%] top-[15px] h-[2px] rounded-full bg-[var(--accent)]"
          initial={false}
          animate={{ width: `${frac * 75}%` }}
          transition={calm()}
        />
        {STEPS.map((s, i) => {
          const done = i < step;
          const on = i === step;
          const can = enabled && i !== step;
          return (
            <li key={s.label} className="relative flex flex-col items-center gap-2">
              <button
                type="button"
                disabled={!can}
                onClick={() => onGo(i)}
                aria-current={on ? 'step' : undefined}
                className="group flex flex-col items-center gap-2 disabled:cursor-default"
              >
                <span className="sr-only">Step </span>
                <motion.span
                  className="grid size-8 place-items-center rounded-full text-[13px] font-semibold"
                  initial={false}
                  animate={{
                    backgroundColor: on || done ? 'var(--accent)' : 'var(--surface-2)',
                    color: on || done ? 'var(--on-accent)' : 'var(--muted)',
                    scale: on ? 1.08 : 1,
                  }}
                  transition={QUICK}
                  style={{ boxShadow: on ? '0 0 0 5px color-mix(in srgb, var(--accent) 22%, transparent)' : 'none' }}
                >
                  {done ? <Check size={15} strokeWidth={3} aria-hidden /> : i + 1}
                </motion.span>
                <span className={`text-center text-[12px] font-semibold leading-tight min-[600px]:text-[13px] ${on ? 'text-ink' : 'text-muted'} ${can ? 'group-hover:text-ink' : ''}`}>
                  <span className="min-[600px]:hidden">{s.short}</span>
                  <span className="hidden min-[600px]:inline">{s.label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
