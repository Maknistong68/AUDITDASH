/**
 * The one motion language of the app (owner, 2026-10-30): slow, calm, felt rather than seen. Every entrance, bar, line
 * and count runs 1.5 s on the same expo-out curve (fast start, long soft landing), no springs, no bounce, no overshoot.
 * Elements arrive in a gentle stagger. Reduced motion (MotionProvider) turns all of it off.
 */

/** Expo-out: cubic-bezier(0.16, 1, 0.3, 1). Mirrors --ease in globals.css. */
export const EASE = [0.16, 1, 0.3, 1] as const;

/** The duration of every entrance, draw and count, in seconds. Mirrors --dur in globals.css. */
export const DUR = 1.5;

/** Delay between siblings arriving, in seconds. */
export const STAGGER = 0.08;

/** A tween on the house curve: `{ ...calm(delay) }` in any framer `transition`. */
export const calm = (delay = 0, duration = DUR) => ({ type: 'tween' as const, ease: EASE, duration, delay });

/** Short hover/press feedback on the same curve (hover must answer quickly, so not 1.5 s). */
export const QUICK = { type: 'tween' as const, ease: EASE, duration: 0.45 };

/** A card's rise: soft fade, small lift, a touch of blur clearing. */
export const RISE = {
  initial: { opacity: 0, y: 18, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
} as const;
