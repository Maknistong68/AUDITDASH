import { createElement, type CSSProperties } from 'react';

/**
 * A category is marked by its colour alone: a plain dot, no pictogram (owner, 2026-10-30: icons read generic).
 * Same call shape as the icon components it replaced (`size`, `style.color`), so every call site stays as it is.
 */
function Dot({ size = 14, style, className = '' }: { size?: number; strokeWidth?: number; style?: CSSProperties; className?: string }) {
  const d = Math.max(7, Math.round(size * 0.55));
  return createElement('span', {
    'aria-hidden': true,
    className: `inline-block shrink-0 rounded-full ${className}`,
    style: { width: d, height: d, background: style?.color ?? 'currentColor' },
  });
}

/** Every category name in lib/categories maps to the same dot; the colour comes from the call site. */
export const CATEGORY_ICONS: Record<string, typeof Dot> = new Proxy({}, { get: () => Dot });
