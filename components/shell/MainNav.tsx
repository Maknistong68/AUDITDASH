'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const ITEMS = [
  { href: '/log', label: 'Log', match: (p: string) => p.startsWith('/log') },
  { href: '/contractors', label: 'Contractors', match: (p: string) => p.startsWith('/contractors') },
] as const;

/**
 * The Log link (every audit and observation: search). The wordmark is the way home to the dashboard; + New audit
 * (input) sits on the right of the bar. Quarter and regions travel with the link.
 */
export function MainNav() {
  const path = usePathname();
  const sp = useSearchParams();
  const keep = new URLSearchParams([...sp].filter(([k]) => k === 'q' || k === 'r' || k === 't')).toString();
  return (
    <nav aria-label="Main" data-testid="main-nav" className="flex h-8 items-center gap-[clamp(14px,1.4vw,24px)]">
      {ITEMS.map((it) => {
        const on = it.match(path);
        return (
          <Link
            key={it.href}
            href={keep ? `${it.href}?${keep}` : it.href}
            aria-current={on ? 'page' : undefined}
            className="tab h-8 text-[14px] leading-8"
          >
            <span className="tab-label">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
