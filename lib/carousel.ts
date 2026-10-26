/** Pure helpers for the swipeable details carousels (slide 0 = latest). */

/** Parse `?s=` into a valid slide index for `count` slides; anything invalid -> 0. */
export function parseSlide(raw: string | string[] | null | undefined, count: number): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === null || v === undefined || !/^\d+$/.test(v) || count <= 0) return 0;
  return Math.min(Number(v), count - 1);
}

/**
 * Where a drag lands. Dragging left (negative offset) moves to the next slide (older); right to newer.
 * Moves one slide when the drag passes `threshold` of the slide width or flicks faster than 500px/s.
 */
export function snapIndex(index: number, count: number, offset: number, velocity: number, width: number, threshold = 0.2): number {
  const far = width > 0 && Math.abs(offset) > width * threshold;
  const flick = Math.abs(velocity) > 500;
  if (!far && !flick) return index;
  const dir = (far ? offset : velocity) < 0 ? 1 : -1;
  return Math.max(0, Math.min(count - 1, index + dir));
}

/** The current search string with `s` set (removed for slide 0), every other param kept. Leading "?" or "". */
export function withSlide(search: string, index: number): string {
  const sp = new URLSearchParams(search);
  if (index > 0) sp.set('s', String(index));
  else sp.delete('s');
  const q = sp.toString();
  return q ? `?${q}` : '';
}
