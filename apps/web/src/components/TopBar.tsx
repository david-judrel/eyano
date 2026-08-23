'use client';

import { useState, useRef, useEffect } from 'react';
import { Menu, LogIn, ChevronDown, Check } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Logo } from './ui/logo';
import { EYANO_MODELS } from '@/lib/models';
import { cn } from '@/lib/utils';

interface TopBarProps {
  onLoginClick?: () => void;
}

export function TopBar({ onLoginClick }: TopBarProps) {
  const { sidebarOpen, setSidebarOpen, user, selectedModel, setSelectedModel } = useAppStore();
  const [modelOpen, setModelOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentModel = EYANO_MODELS.find((m) => m.id === selectedModel);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setModelOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="flex items-center justify-between px-4 lg:px-5 h-[52px] shrink-0 border-b border-border bg-surface/80 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-2 transition-all"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>

        <div className="flex items-center gap-2.5">
          <Logo size="md" />
          <span className="text-[15px] font-bold tracking-tight text-foreground">Eyano</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Model Selector */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setModelOpen(!modelOpen)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-200',
              modelOpen
                ? 'bg-surface-2 text-foreground border border-border-strong'
                : 'text-muted hover:text-foreground hover:bg-surface-2 border border-transparent'
            )}
          >
            <Logo size="sm" className="opacity-60 shrink-0" />
            <span className="max-w-[100px] truncate">{currentModel?.name || 'Gnoxe Brains'}</span>
            <ChevronDown className={cn('h-3 w-3 transition-transform duration-200', modelOpen && 'rotate-180')} />
          </button>

          {modelOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-surface border border-border shadow-[0_8px_32px_rgba(0,0,0,0.3)] z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 overflow-hidden p-1.5">
              {EYANO_MODELS.filter((m) => m.available).map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setSelectedModel(m.id); setModelOpen(false); }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] transition-all duration-150',
                    selectedModel === m.id
                      ? 'bg-brand/10 text-brand'
                      : 'text-foreground/70 hover:bg-surface-2 hover:text-foreground'
                  )}
                >
                  <Logo size="sm" className={cn('shrink-0', selectedModel === m.id ? 'opacity-100' : 'opacity-40')} />
                  <span className="flex-1 text-left font-medium">{m.name}</span>
                  {selectedModel === m.id && <Check className="h-3.5 w-3.5 text-brand shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {!user && (
          <button
            onClick={onLoginClick}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand text-brand-foreground text-[12px] font-bold hover:brightness-110 transition-all"
          >
            <LogIn className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Connexion</span>
          </button>
        )}
      </div>
    </header>
  );
}
