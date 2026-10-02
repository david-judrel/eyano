'use client';

import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { IconButton } from '@/components/ui/button';
import { Card, Spinner } from '@/components/ui/feedback';

/* Elements communs des pages d'administration (une seule definition). */

/** Statistique : libelle, valeur, precision. Le chiffre reste neutre. */
export function Stat({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <Card>
      <div className="flex items-center gap-2 text-foreground-muted">
        <Icon className="icon-sm" aria-hidden />
        <span className="text-caption">{label}</span>
      </div>
      <p className="mt-2 text-heading-lg tabular-nums text-foreground">{value}</p>
      {detail && <p className="mt-0.5 text-caption text-foreground-muted">{detail}</p>}
    </Card>
  );
}

/** Panneau titre : en-tete, puis contenu sans marge (listes, tableaux). */
export function Panel({ title, icon: Icon, actions, children, className }: {
  title: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card padding="none" className={cn('overflow-hidden', className)}>
      <div className="flex h-12 items-center justify-between gap-3 border-b border-border-subtle px-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="icon-sm text-foreground-muted" aria-hidden />}
          <h2 className="text-heading-sm text-foreground">{title}</h2>
        </div>
        {actions}
      </div>
      {children}
    </Card>
  );
}

/** Chargement d'une zone de contenu. */
export function LoadingBlock({ label = 'Chargement', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex h-48 items-center justify-center', className)}>
      <Spinner label={label} size="md" />
    </div>
  );
}

/** Pagination : position + precedent / suivant. */
export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-border-subtle px-4 py-2">
      <span className="text-caption text-foreground-muted">Page {page} sur {pages}</span>
      <div className="flex gap-1">
        <IconButton label="Page précédente" icon={ChevronLeft} size="sm" variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)} />
        <IconButton label="Page suivante" icon={ChevronRight} size="sm" variant="outline" disabled={page >= pages} onClick={() => onChange(page + 1)} />
      </div>
    </div>
  );
}

const roleLabels: Record<string, { label: string; tone: BadgeProps['tone'] }> = {
  SUPER_ADMIN: { label: 'Super admin', tone: 'info' },
  ADMIN: { label: 'Admin', tone: 'brand' },
  USER: { label: 'Utilisateur', tone: 'neutral' },
};

export function RoleBadge({ role }: { role: string }) {
  const { label, tone } = roleLabels[role] ?? { label: role, tone: 'neutral' as const };
  return <Badge tone={tone}>{label}</Badge>;
}

const statusLabels: Record<string, { label: string; tone: BadgeProps['tone'] }> = {
  ACTIVE: { label: 'Actif', tone: 'success' },
  INACTIVE: { label: 'Inactif', tone: 'warning' },
  BANNED: { label: 'Banni', tone: 'error' },
  SUSPENDED: { label: 'Suspendu', tone: 'error' },
};

export function StatusBadge({ status }: { status: string }) {
  const { label, tone } = statusLabels[status] ?? { label: status, tone: 'neutral' as const };
  return <Badge tone={tone}>{label}</Badge>;
}
