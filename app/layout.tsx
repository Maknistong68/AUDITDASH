import type { Metadata } from 'next';
import { MotionProvider } from '@/components/motion/MotionProvider';
import './globals.css';

/*
 * The data-terminal style (design-taste-frontend app sheet): Public Sans for every word, IBM Plex Mono for every figure so
 * digits stack in columns. Declared under their own family names in globals.css (@font-face, files in public/fonts),
 * served from this app so the build stays offline-safe; the two used weights are preloaded here.
 */
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
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preload" href="/fonts/public-sans-latin-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/ibm-plex-mono-latin-500-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
