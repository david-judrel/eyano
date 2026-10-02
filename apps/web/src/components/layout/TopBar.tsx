'use client';

import { Check, ChevronDown, LogIn, Menu } from 'lucide-react';
import { EYANO_MODELS } from '@eyano/types';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/logo';
import { Button, IconButton } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/overlay';

interface TopBarProps {
  onLoginClick?: () => void;
}

/**
 * Barre superieure du chat : menu (mobile), marque (quand la barre laterale
 * n'est pas visible), choix du modele, connexion.
 */
export function TopBar({ onLoginClick }: TopBarProps) {
  const { setSidebarOpen, user, selectedModel, setSelectedModel } = useAppStore();
  const currentModel = EYANO_MODELS.find((m) => m.id === selectedModel);

  return (
    <header className="sticky top-0 z-sticky flex h-topbar shrink-0 items-center justify-between gap-2 border-b border-border-subtle bg-background px-3 lg:px-4">
      <div className="flex items-center gap-1">
        {user && <IconButton label="Ouvrir le menu" icon={Menu} className="lg:hidden" onClick={() => setSidebarOpen(true)} tooltip={false} />}
        <div className={cn('flex items-center gap-2 px-1', user && 'lg:hidden')}>
          <Logo size="md" />
          <span className="text-heading-sm text-foreground">Eyano</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label={`Modèle : ${currentModel?.name || 'Gnoxe Brains'}`}>
              <span className="max-w-32 truncate">{currentModel?.name || 'Gnoxe Brains'}</span>
              <ChevronDown className="icon-xs text-foreground-muted" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Modèle</DropdownMenuLabel>
            {EYANO_MODELS.filter((m) => m.available).map((m) => (
              <DropdownMenuItem key={m.id} onSelect={() => setSelectedModel(m.id)}>
                <span className="flex items-center justify-between gap-2">
                  {m.name}
                  {selectedModel === m.id && <Check className="icon-sm text-brand-text" aria-label="Sélectionné" />}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {!user && (
          <Button variant="primary" size="sm" icon={LogIn} onClick={onLoginClick}>
            Connexion
          </Button>
        )}
      </div>
    </header>
  );
}
