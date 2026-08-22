'use client';

import { useRouter } from 'next/navigation';
import { Home, Search } from 'lucide-react';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen w-full bg-[#050505] items-center justify-center px-6">
      <div className="text-center max-w-[400px] animate-fade-in">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#39FF14]/20 bg-[#39FF14]/[8%]">
          <span className="text-3xl font-bold text-[#39FF14]">404</span>
        </div>
        <h1 className="text-2xl font-bold text-[#F2FFF0] mb-2">Page introuvable</h1>
        <p className="text-sm text-[#F2FFF0]/40 mb-8">
          La page que vous recherchez n&apos;existe pas ou a ete deplacee.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#F2FFF0]/[8%] bg-[#0D0F0E] text-[#F2FFF0] text-sm font-medium hover:border-[#39FF14]/30 transition-all"
          >
            <Search className="h-4 w-4" />
            Retour
          </button>
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#39FF14] text-[#050505] text-sm font-bold hover:brightness-110 transition-all"
          >
            <Home className="h-4 w-4" />
            Accueil
          </button>
        </div>
      </div>
    </div>
  );
}
