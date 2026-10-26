'use client';
import { animate, useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';

/**
 * Renders `format(value)` on the server, then counts from the previous value (0 on mount) to `value`.
 * Writes straight to the DOM node, so counting never re-renders React. Instant under reduced motion.
 */
export function CountUp({ value, format, duration = 1.1 }: { value: number; format: (n: number) => string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const start = from.current;
    from.current = value;
    if (reduce || !Number.isFinite(value)) {
      node.textContent = format(value);
      return;
    }
    const controls = animate(start, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (n) => { node.textContent = format(n); },
    });
    return () => controls.stop();
  }, [value, format, duration, reduce]);

  return <span ref={ref} className="num">{format(value)}</span>;
}
