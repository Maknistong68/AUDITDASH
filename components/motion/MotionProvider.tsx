'use client';
import { MotionConfig } from 'framer-motion';

/** Framer honours the OS reduced-motion setting everywhere (transforms and layout morphs become instant). */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
