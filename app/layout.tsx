import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { GeistSans } from 'geist/font/sans';
import { MotionProvider } from '@/components/motion/MotionProvider';
import './globals.css';

/** Display serif for the big numerals and section titles (bundled from @fontsource, no network at build). */
const instrument = localFont({
  src: '../node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2',
  variable: '--font-instrument',
  weight: '400',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'HSE Audit Dashboard',
  description: 'Health & Safety audit gaps across contractors',
};

/**
 * Runs before first paint: marks JS as available (count-ups hide their server value until they start)
 * and applies the stored theme, else the OS preference. Never throws.
 */
const THEME_SCRIPT = `(function(){var d=document.documentElement,t;d.classList.add('js');try{t=localStorage.getItem('theme')}catch(e){}if(t!=='light'&&t!=='dark'){try{t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch(e){t='light'}}d.setAttribute('data-theme',t)})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${instrument.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
