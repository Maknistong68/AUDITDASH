'use client';
import { Moon, Sun } from 'lucide-react';

/** Flips data-theme on <html> and remembers it. The icon is chosen by CSS, so SSR never mismatches. */
export function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch { /* storage blocked: theme lasts for this page only */ }
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle colour theme"
      title="Toggle theme"
      className="grid size-8 place-items-center rounded-full bg-fill text-muted transition-[color,transform] hover:text-ink active:scale-90"
    >
      <Moon size={16} className="theme-icon-moon" aria-hidden />
      <Sun size={16} className="theme-icon-sun" aria-hidden />
    </button>
  );
}
