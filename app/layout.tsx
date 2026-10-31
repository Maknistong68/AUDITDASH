import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { MotionProvider } from '@/components/motion/MotionProvider';
import './globals.css';

/**
 * The data-terminal style (design-taste-frontend, app sheet): Public Sans for every word, IBM Plex Mono for every figure so
 * digits stack in columns. Both bundled from @fontsource so the build stays offline-safe.
 */
const publicSans = localFont({
  src: '../node_modules/@fontsource-variable/public-sans/files/public-sans-latin-wght-normal.woff2',
  variable: '--font-text',
  weight: '100 900',
  display: 'swap',
});
const plexMono = localFont({
  src: [
    { path: '../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2', weight: '400' },
    { path: '../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2', weight: '500' },
    { path: '../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2', weight: '600' },
  ],
  variable: '--font-figure',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Audits', template: '%s · Audits' },
  description: 'Audit scores across contractors: H&S, Security, Environmental, Welfare and CRC',
  // The mock data is real audit data: keep every page out of search engines.
  robots: { index: false, follow: false },
};

/**
 * Runs before first paint: marks JS as available (count-ups hide their server value until they start) and applies the
 * stored theme, else dark (the default). Never throws.
 */
const THEME_SCRIPT = `(function(){var d=document.documentElement,t;d.classList.add('js');try{t=localStorage.getItem('theme')}catch(e){}if(t!=='light'){t='dark'}d.setAttribute('data-theme',t)})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${publicSans.variable} ${plexMono.variable}`} data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
