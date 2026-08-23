import './globals.css';
import Script from 'next/script';
import { PWAProvider } from '@/components/PWAProvider';
import { SWRegister } from '@/components/SWRegister';
import { ThemeProvider } from '@/lib/theme-provider';
import { getDefaultMetadata } from '@/lib/metadata';

export const metadata = getDefaultMetadata();

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#050505',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">{`
          (function() {
            var saved = localStorage.getItem('eyano-theme');
            var theme = saved || 'system';
            var isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
            document.documentElement.classList.toggle('dark', isDark);
          })();
        `}</Script>
      </head>
      <body className="h-dvh bg-background text-foreground antialiased overflow-hidden">
        <ThemeProvider>
          <PWAProvider>
            {children}
            <SWRegister />
          </PWAProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
