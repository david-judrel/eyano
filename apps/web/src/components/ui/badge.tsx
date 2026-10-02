import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/** Etiquette courte (role, statut, compteur). Le ton porte le sens, pas la decoration. */
export const badgeVariants = cva('inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-caption font-medium', {
  variants: {
    tone: {
      neutral: 'bg-surface-raised text-foreground-secondary border border-border-subtle',
      brand: 'bg-brand-subtle text-brand-text',
      success: 'bg-success-subtle text-success',
      warning: 'bg-warning-subtle text-warning',
      error: 'bg-error-subtle text-error',
      info: 'bg-info-subtle text-info',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
