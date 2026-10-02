'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------- Separator */

export function Separator({ orientation = 'horizontal', className }: { orientation?: 'horizontal' | 'vertical'; className?: string }) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn('shrink-0 bg-border-subtle', orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', className)}
    />
  );
}

/* -------------------------------------------------------------- Skeleton */

/** Emplacement pendant un chargement. Decoratif : masque aux lecteurs d'ecran. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('animate-pulse-subtle rounded-md bg-selected', className)} {...props} />;
}

/* --------------------------------------------------------------- Spinner */

export function Spinner({ label = 'Chargement', size = 'sm', className }: { label?: string; size?: 'sm' | 'md'; className?: string }) {
  return (
    <span role="status" className={cn('inline-flex text-foreground-muted', className)}>
      <Loader2 className={cn('animate-spin', size === 'md' ? 'icon-md' : 'icon-sm')} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/* -------------------------------------------------------------- Progress */

interface ProgressProps {
  /** 0 a 100 ; absent = progression indeterminee. */
  value?: number;
  label: string;
  className?: string;
}

export function Progress({ value, label, className }: ProgressProps) {
  const known = typeof value === 'number';
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={known ? Math.round(value) : undefined}
      className={cn('h-1 w-full overflow-hidden rounded-full bg-border-subtle', className)}
    >
      <div
        className={cn('h-full rounded-full bg-brand transition-[width] duration-slow ease-standard', !known && 'w-1/3 animate-pulse-subtle')}
        style={known ? { width: `${Math.max(0, Math.min(100, value))}%` } : undefined}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ Card */

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Carte cliquable : bordure au survol. */
  interactive?: boolean;
  padding?: 'none' | 'md' | 'lg';
}

export function Card({ className, interactive = false, padding = 'md', ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border-subtle bg-surface-raised',
        padding === 'md' && 'p-4',
        padding === 'lg' && 'p-6',
        interactive && 'transition-colors duration-fast hover:border-border-strong',
        className
      )}
      {...props}
    />
  );
}

/* ----------------------------------------------------------------- Alert */

type Tone = 'info' | 'success' | 'warning' | 'error';

const toneStyles: Record<Tone, { box: string; icon: LucideIcon; color: string }> = {
  info: { box: 'bg-info-subtle', icon: Info, color: 'text-info' },
  success: { box: 'bg-success-subtle', icon: CheckCircle2, color: 'text-success' },
  warning: { box: 'bg-warning-subtle', icon: AlertTriangle, color: 'text-warning' },
  error: { box: 'bg-error-subtle', icon: AlertCircle, color: 'text-error' },
};

interface AlertProps {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Message en ligne. `error` et `warning` sont annonces aux lecteurs d'ecran. */
export function Alert({ tone = 'info', title, children, action, className }: AlertProps) {
  const style = toneStyles[tone];
  const Icon = style.icon;
  return (
    <div
      role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-md px-3 py-2', style.box, className)}
    >
      <Icon className={cn('icon-sm mt-0.5', style.color)} aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {title && <p className={cn('text-label', style.color)}>{title}</p>}
        {children && <div className="text-body-sm text-foreground-secondary">{children}</div>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------ EmptyState */

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-4 py-12 text-center', className)}>
      <Icon className="icon-md mb-3 text-foreground-muted" aria-hidden />
      <h3 className="text-heading-sm text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-xs text-body-sm text-foreground-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
