'use client';

import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/lib/theme-provider';

const icons = {
  dark: Moon,
  light: Sun,
  system: Monitor,
};

const labels = {
  dark: 'Sombre',
  light: 'Clair',
  system: 'Systeme',
};

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  const cycle = () => {
    const next = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
    setTheme(next);
  };

  const Icon = icons[theme];

  return (
    <button
      onClick={cycle}
      title={labels[theme]}
      className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-2 transition-all"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
