import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Colonne de contenu : largeur plafonnee, gouttieres responsives. */
export function Container({ size = 'content', className, children }: { size?: 'content' | 'wide'; className?: string; children: ReactNode }) {
  return (
    <div className={cn('mx-auto w-full px-4 sm:px-6', size === 'content' ? 'max-w-content' : 'max-w-6xl', className)}>
      {children}
    </div>
  );
}

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Actions alignees a droite (boutons). */
  actions?: ReactNode;
  /** Element place avant le titre (retour). */
  leading?: ReactNode;
  className?: string;
}

/** En-tete de page : titre, description, actions. Le meme partout. */
export function PageHeader({ title, description, actions, leading, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {leading}
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-heading-xl text-foreground">{title}</h1>
          {description && <p className="text-body-md text-foreground-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
