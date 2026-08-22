'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr" className="dark h-full" suppressHydrationWarning>
      <body className="antialiased h-[100dvh] w-full overflow-hidden bg-[#050505] text-[#F2FFF0]">
        <div className="flex h-full w-full items-center justify-center px-6">
          <div className="text-center max-w-[400px] animate-fade-in">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/[8%]">
              <AlertTriangle className="h-7 w-7 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-[#F2FFF0] mb-2">Erreur critique</h1>
            <p className="text-sm text-[#F2FFF0]/40 mb-8">
              L&apos;application a rencontre un probleme inattendu.
            </p>
            <button
              onClick={reset}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#39FF14] text-[#050505] text-sm font-bold hover:brightness-110 transition-all mx-auto"
            >
              <RefreshCw className="h-4 w-4" />
              Reessayer
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
