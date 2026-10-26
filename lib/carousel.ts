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

/**
 * The current search string with `s` set, every other param kept. Leading "?" or "".
 * Slide 0 drops `s`, except when a quarter filter is set: there an absent `s` means "open on that quarter"
 * (see initialSlide), so slide 0 is written as `s=0` to survive a reload.
 */
export function withSlide(search: string, index: number): string {
  const sp = new URLSearchParams(search);
  const q = sp.get('q');
  if (index > 0 || (q !== null && q !== 'all')) sp.set('s', String(index));
  else sp.delete('s');
  const out = sp.toString();
  return out ? `?${out}` : '';
}

/**
 * The slide a details carousel opens on. A valid `?s=` wins; otherwise, when the page filter names a quarter,
 * the first slide (slides are latest first) in that quarter, so the details match the overview row that linked here;
 * otherwise slide 0.
 */
export function initialSlide(raw: string | string[] | null | undefined, quarters: readonly string[], filterQuarter: string): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v === 'string' && /^\d+$/.test(v)) return parseSlide(v, quarters.length);
  if (filterQuarter !== 'all') {
    const i = quarters.indexOf(filterQuarter);
    if (i >= 0) return i;
  }
  return 0;
}
