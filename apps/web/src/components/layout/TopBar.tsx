'use client';

import { LogIn, Menu } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/logo';
import { Button, IconButton } from '@/components/ui/button';

interface TopBarProps {
  onLoginClick?: () => void;
}

/**
 * Barre superieure du chat : menu et marque (mobile), connexion (invite).
 * Sur desktop, un utilisateur connecte n'en a pas besoin : elle disparait.
 */
export function TopBar({ onLoginClick }: TopBarProps) {
  const { setSidebarOpen, user } = useAppStore();

  return (
    <header className={cn('sticky top-0 z-sticky flex h-topbar shrink-0 items-center justify-between gap-2 border-b border-border-subtle bg-background px-3 lg:px-4', user && 'lg:hidden')}>
      <div className="flex items-center gap-1">
        {user && <IconButton label="Ouvrir le menu" icon={Menu} className="lg:hidden" onClick={() => setSidebarOpen(true)} tooltip={false} />}
        <div className={cn('flex items-center gap-2 px-1', user && 'lg:hidden')}>
          <Logo size="md" />
          <span className="text-heading-sm text-foreground">Eyano</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!user && (
          <Button variant="primary" size="sm" icon={LogIn} onClick={onLoginClick}>
            Connexion
          </Button>
        )}
      </div>
    </header>
  );
}
