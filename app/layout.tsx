import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { MotionProvider } from '@/components/motion/MotionProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'HSE Audit Dashboard',
  description: 'Health & Safety audit gaps across contractors',
};

/** Runs before first paint: stored choice, else the OS preference. Never throws. */
const THEME_SCRIPT = `(function(){var d=document.documentElement,t;try{t=localStorage.getItem('theme')}catch(e){}if(t!=='light'&&t!=='dark'){try{t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch(e){t='light'}}d.setAttribute('data-theme',t)})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={GeistSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
