'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme-provider';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/tooltip';

const options = [
  { value: 'light' as const, icon: Sun, label: 'Thème clair' },
  { value: 'dark' as const, icon: Moon, label: 'Thème sombre' },
  { value: 'system' as const, icon: Monitor, label: 'Thème du système' },
];

/** Choix du theme : controle segmente (groupe de boutons radio). */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div role="radiogroup" aria-label="Thème" className={cn('inline-flex rounded-md bg-selected p-0.5', className)}>
      {options.map(({ value, icon: Icon, label }) => {
        const active = theme === value;
        return (
          <Tooltip key={value} content={label}>
            <button
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={label}
              onClick={() => setTheme(value)}
              className={cn(
                'flex h-7 w-8 items-center justify-center rounded-sm transition-colors duration-fast',
                active ? 'bg-surface-overlay text-foreground shadow-subtle' : 'text-foreground-muted hover:text-foreground'
              )}
            >
              <Icon className="icon-xs" aria-hidden />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
