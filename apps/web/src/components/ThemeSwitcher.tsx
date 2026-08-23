'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme-provider';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Détermine quelle icône afficher selon l'état actuel
  const getIcon = () => {
    if (theme === 'system') return <Monitor className="h-4 w-4" />;
    return resolvedTheme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />;
  };

  // Cycle: system -> dark -> light -> system
  const cycleTheme = () => {
    if (theme === 'system') setTheme('dark');
    else if (theme === 'dark') setTheme('light');
    else setTheme('system');
  };

  return (
    <button
      onClick={cycleTheme}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px]',
        'text-[var(--ey-muted-foreground)] hover:text-[var(--ey-foreground)]',
        'hover:bg-[var(--ey-surface-2)] transition-all duration-200 group'
      )}
      title={`Thème: ${theme === 'system' ? 'Système' : theme === 'dark' ? 'Sombre' : 'Clair'}`}
    >
      <div className={cn(
        'p-2 rounded-lg bg-[var(--ey-brand-dim)] border border-[var(--ey-brand)]/10',
        'group-hover:bg-[var(--ey-brand)]/20 transition-colors'
      )}>
        {getIcon()}
      </div>
      
      <span className="flex-1 text-left">
        {theme === 'system' ? 'Automatique' : resolvedTheme === 'dark' ? 'Mode sombre' : 'Mode clair'}
      </span>
      
      {/* Indicateur visuel subtil */}
      <div className={cn(
        'w-1.5 h-1.5 rounded-full',
        theme === 'system' ? 'bg-[var(--ey-muted-foreground)]' : 'bg-[var(--ey-brand)]'
      )} />
    </button>
  );
}