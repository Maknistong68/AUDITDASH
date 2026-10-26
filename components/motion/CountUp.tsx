'use client';
import { animate, useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';

/**
 * Counts once from 0 to `value` (then from the previous value on later changes).
 * The server renders the final value (correct without JS); with JS, a pre-paint `html.js` class hides it
 * until this effect writes the start value and marks it ready, so there is no final -> 0 snap.
 * Writes straight to the DOM node; instant under reduced motion.
 */
export function CountUp({
  value,
  format,
  duration = 1.1,
  delay = 0,
}: { value: number; format: (n: number) => string; duration?: number; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const start = from.current;
    from.current = value;
    const ready = () => node.setAttribute('data-ready', '');
    if (reduce || !Number.isFinite(value)) {
      node.textContent = format(value);
      ready();
      return;
    }
    node.textContent = format(start);
    ready();
    const controls = animate(start, value, {
      duration,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (n) => { node.textContent = format(n); },
    });
    return () => controls.stop();
  }, [value, format, duration, delay, reduce]);

  return <span ref={ref} data-countup className="num">{format(value)}</span>;
}
