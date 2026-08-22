'use client';

import { Menu, LogIn } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Logo } from './ui/logo';

interface TopBarProps {
  onLoginClick?: () => void;
}

export function TopBar({ onLoginClick }: TopBarProps) {
  const { sidebarOpen, setSidebarOpen, user } = useAppStore();

  return (
    <header className="flex items-center justify-between px-4 lg:px-5 h-[52px] shrink-0 border-b border-white/[6%] bg-[#08090a]/80 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[6%] transition-all"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>

        <div className="flex items-center gap-2.5">
          <Logo size="md" />
          <span className="text-[15px] font-bold tracking-tight text-white">Eyano</span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {!user && (
          <button
            onClick={onLoginClick}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#39FF14] text-[#050505] text-[12px] font-bold hover:brightness-110 transition-all"
          >
            <LogIn className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Connexion</span>
          </button>
        )}
      </div>
    </header>
  );
}
