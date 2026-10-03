import './globals.css';
import { Inter, JetBrains_Mono } from 'next/font/google';
import Script from 'next/script';
import { PWAProvider } from '@/components/PWAProvider';
import { SWRegister } from '@/components/SWRegister';
import { ThemeProvider } from '@/lib/theme-provider';
import { AppProviders } from '@/components/AppProviders';
import { getDefaultMetadata } from '@/lib/metadata';

const fontSans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const fontMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata = getDefaultMetadata();

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#050505' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`dark ${fontSans.variable} ${fontMono.variable}`} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon-192.png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/icon-512.png" sizes="512x512" />
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
          <AppProviders>
            <PWAProvider>
              {children}
              {/* <SWRegister /> */}
            </PWAProvider>
          </AppProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}
