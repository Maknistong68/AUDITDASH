import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { MotionProvider } from '@/components/motion/MotionProvider';
import './globals.css';

/**
 * Inter (variable weight + optical size), bundled from @fontsource-variable so the build stays offline-safe.
 * On Apple devices the stack in globals.css resolves to SF Pro first; Inter is the SF-like fallback elsewhere.
 */
const inter = localFont({
  src: '../node_modules/@fontsource-variable/inter/files/inter-latin-opsz-normal.woff2',
  variable: '--font-inter',
  weight: '100 900',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'HSE Audit Dashboard',
  description: 'Health & Safety audit scores across contractors',
};

/**
 * Runs before first paint: marks JS as available (count-ups hide their server value until they start)
 * and applies the stored theme, else the OS preference. Never throws.
 */
const THEME_SCRIPT = `(function(){var d=document.documentElement,t;d.classList.add('js');try{t=localStorage.getItem('theme')}catch(e){}if(t!=='light'&&t!=='dark'){try{t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch(e){t='light'}}d.setAttribute('data-theme',t)})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
