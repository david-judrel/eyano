'use client';

import { AlertCircle, AlertTriangle, CheckCircle2, Info, X, type LucideIcon } from 'lucide-react';
import { useToast, type ToastType } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { IconButton } from './button';

const tones: Record<ToastType, { icon: LucideIcon; color: string }> = {
  error: { icon: AlertCircle, color: 'text-error' },
  success: { icon: CheckCircle2, color: 'text-success' },
  info: { icon: Info, color: 'text-info' },
  warning: { icon: AlertTriangle, color: 'text-warning' },
};

/**
 * Notifications ephemeres (alimentees par `useToast`). Rendu UNE fois, a la
 * racine. Surface neutre ; seul l'icone porte le ton. Annoncees aux lecteurs
 * d'ecran (role status / alert).
 */
export function Toaster() {
  const { toasts, removeToast } = useToast();

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-toast flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:items-end"
    >
      {toasts.map((toast) => {
        const tone = tones[toast.type];
        const Icon = tone.icon;
        return (
          <div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-lg border border-border bg-surface-overlay py-2 pl-3 pr-1 shadow-overlay animate-slide-up"
          >
            <Icon className={cn('icon-sm', tone.color)} aria-hidden />
            <p className="flex-1 text-body-sm text-foreground">{toast.message}</p>
            <IconButton label="Fermer la notification" icon={X} size="sm" tooltip={false} onClick={() => removeToast(toast.id)} />
          </div>
        );
      })}
    </div>
  );
}
