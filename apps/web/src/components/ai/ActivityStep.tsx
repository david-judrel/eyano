'use client';

import type { ReactNode } from 'react';
import { AlertCircle, Check, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ActivityStatus = 'idle' | 'running' | 'success' | 'error';

interface ActivityStepProps {
  /** Icone de la capacite (Search, Sparkles, Wrench...). */
  icon: LucideIcon;
  label: ReactNode;
  status: ActivityStatus;
  /** Precision : etape, nombre de sources, duree... */
  detail?: ReactNode;
  /** Contenu associe (sources, progression, apercu). */
  children?: ReactNode;
  className?: string;
}

/**
 * LA grammaire de l'activite d'EYANO (recherche, Kepler, outils, missions).
 *
 *   [icone]  Libelle
 *            detail / contenu
 *
 * Quatre etats, une seule forme. Le vert n'apparait que pendant `running`.
 * Une nouvelle capacite choisit une icone et un libelle, jamais un nouveau
 * composant.
 */
export function ActivityStep({ icon: Icon, label, status, detail, children, className }: ActivityStepProps) {
  const StatusIcon = status === 'success' ? Check : status === 'error' ? AlertCircle : Icon;

  return (
    <div role="status" aria-live="polite" className={cn('flex items-start gap-2', className)}>
      <span
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
          status === 'running' && 'bg-brand-subtle text-brand-text',
          status === 'success' && 'text-foreground-muted',
          status === 'error' && 'text-error',
          status === 'idle' && 'text-foreground-muted'
        )}
      >
        <StatusIcon className={cn('icon-xs', status === 'running' && 'animate-pulse-subtle')} aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className={cn('text-body-sm', status === 'running' ? 'text-foreground' : 'text-foreground-secondary')}>
          {label}
          {status === 'running' && <span className="sr-only"> (en cours)</span>}
          {status === 'error' && <span className="sr-only"> (échec)</span>}
        </p>
        {detail && <p className="text-caption text-foreground-muted">{detail}</p>}
        {children}
      </div>
    </div>
  );
}
