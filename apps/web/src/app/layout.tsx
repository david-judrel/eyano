import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PWAProvider } from '@/components/PWAProvider';
import { SWRegister } from '@/components/SWRegister';

export const metadata: Metadata = {
  title: 'Eyano - AI Assistant',
  description: 'Eyano, votre assistant intelligent par Gnoxe',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Eyano',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#050505',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="dark h-full" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon.png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@fontsource-variable/inter@5.0.0/index.css"
        />
      </head>
      <body className="antialiased h-[100dvh] w-full overflow-hidden overscroll-none bg-[#050505] text-[#F2FFF0]">
        <SWRegister />
        <PWAProvider>{children}</PWAProvider>
      </body>
    </html>
  );
}
