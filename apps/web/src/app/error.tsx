'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error('[Eyano Error]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen w-full bg-background items-center justify-center px-6">
      <div className="text-center max-w-[400px] animate-fade-in">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/[8%]">
          <AlertTriangle className="h-7 w-7 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Erreur</h1>
        <p className="text-sm text-muted mb-8">
          {error.message || 'Une erreur inattendue s\'est produite.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-surface text-foreground text-sm font-medium hover:border-brand/30 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            Accueil
          </button>
          <button
            onClick={reset}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand text-brand-foreground text-sm font-bold hover:brightness-110 transition-all"
          >
            <RefreshCw className="h-4 w-4" />
            Reessayer
          </button>
        </div>
      </div>
    </div>
  );
}
