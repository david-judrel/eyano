'use client';

import { useRouter } from 'next/navigation';
import { Home, Search } from 'lucide-react';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen w-full bg-background items-center justify-center px-6">
      <div className="text-center max-w-[400px] animate-fade-in">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-brand/20 bg-brand/[8%]">
          <span className="text-3xl font-bold text-brand">404</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Page introuvable</h1>
        <p className="text-sm text-muted mb-8">
          La page que vous recherchez n&apos;existe pas ou a ete deplacee.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-surface text-foreground text-sm font-medium hover:border-brand/30 transition-all"
          >
            <Search className="h-4 w-4" />
            Retour
          </button>
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand text-brand-foreground text-sm font-bold hover:brightness-110 transition-all"
          >
            <Home className="h-4 w-4" />
            Accueil
          </button>
        </div>
      </div>
    </div>
  );
}
