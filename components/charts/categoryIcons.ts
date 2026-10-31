import { createElement, type CSSProperties } from 'react';

/**
 * A category mark: a small neutral dot, no pictogram and no hue (owner, 2026-10-30: icons read generic; data-terminal
 * style: colour stays on data, so eight category hues would be a rainbow). Same call shape as the icon components it
 * replaced (`size`, `style`), so every call site stays as it is; the category's name carries its identity.
 */
function Dot({ size = 14, className = '' }: { size?: number; strokeWidth?: number; style?: CSSProperties; className?: string }) {
  const d = Math.max(7, Math.round(size * 0.55));
  return createElement('span', {
    'aria-hidden': true,
    className: `inline-block shrink-0 rounded-full ${className}`,
    style: { width: d, height: d, background: 'var(--control)' },
  });
}

/** Every category name in lib/categories maps to the same dot; the colour comes from the call site. */
export const CATEGORY_ICONS: Record<string, typeof Dot> = new Proxy({}, { get: () => Dot });
