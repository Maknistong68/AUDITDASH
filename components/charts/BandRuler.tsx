'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { bandFor } from '@/lib/scoring';

const LO = 0.5;
const EDGES = [0.6, 0.7, 0.8, 0.9];
const SEGMENTS: [number, number][] = [[0.5, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 0.9], [0.9, 1]];
const at = (v: number) => `${((Math.min(1, Math.max(LO, v)) - LO) / (1 - LO)) * 100}%`;

/** Thin neutral band ruler (50–100%): the current band drawn in ink, a marker sliding to the score. */
export function BandRuler({ value, delay = 0 }: { value: number; delay?: number }) {
  const reduce = useReducedMotion();
  const band = bandFor(value);
  return (
    <div className="w-full max-w-[420px]" role="img" aria-label={`Band ruler: ${band}`}>
      <div className="relative h-5">
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-control" aria-hidden />
        {SEGMENTS.map(([a, b]) =>
          bandFor(a) === band ? (
            <span key={a} className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-ink" style={{ left: at(a), width: `calc(${at(b)} - ${at(a)})` }} aria-hidden />
          ) : null,
        )}
        {EDGES.map((e) => (
          <span key={e} className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-control" style={{ left: at(e) }} aria-hidden />
        ))}
        <motion.span
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ground bg-accent"
          initial={reduce ? false : { left: '0%' }}
          animate={{ left: at(value) }}
          transition={{ duration: reduce ? 0 : 1.1, delay: reduce ? 0 : delay, ease: [0.16, 1, 0.3, 1] }}
          aria-hidden
        />
      </div>
      <div className="num relative h-4 text-[11px] leading-4 text-faint" aria-hidden>
        {EDGES.map((e) => (
          <span key={e} className="absolute -translate-x-1/2" style={{ left: at(e) }}>{Math.round(e * 100)}</span>
        ))}
      </div>
    </div>
  );
}
