'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from './tooltip';

/**
 * Bouton EYANO. `primary` (vert) : l'action principale de la vue, une seule.
 * Le focus clavier vient du style global (:focus-visible).
 */
export const buttonVariants = cva(
  [
    'inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md text-label',
    'transition-colors duration-fast ease-standard',
    'disabled:cursor-not-allowed disabled:bg-transparent disabled:text-foreground-disabled disabled:border-border-subtle',
    'aria-busy:cursor-progress',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-brand text-brand-foreground hover:bg-brand-hover active:bg-brand-active disabled:bg-surface',
        secondary: 'bg-surface-raised text-foreground border border-border hover:border-border-strong hover:bg-hover active:bg-pressed',
        outline: 'border border-border text-foreground hover:bg-hover active:bg-pressed',
        ghost: 'text-foreground-secondary hover:bg-hover hover:text-foreground active:bg-pressed',
        destructive: 'bg-error-subtle text-error hover:bg-error hover:text-foreground-inverse active:bg-error',
      },
      size: {
        sm: 'h-8 px-3',
        md: 'h-10 px-4',
        lg: 'h-12 px-5 text-body-md font-medium',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  }
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Affiche un indicateur et bloque l'action. */
  loading?: boolean;
  /** Icone Lucide placee avant le libelle. */
  icon?: LucideIcon;
  /** Rend l'enfant (lien...) avec le style du bouton. */
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading = false, icon: Icon, asChild = false, disabled, children, type = 'button', ...props }, ref) => {
    if (asChild) {
      return <Slot ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props}>{children}</Slot>;
    }
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {loading ? <Loader2 className="icon-sm animate-spin" aria-hidden /> : Icon ? <Icon className="icon-sm" aria-hidden /> : null}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

const iconButtonSizes = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-12 w-12' } as const;

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Nom accessible, OBLIGATOIRE : lu par les lecteurs d'ecran, affiche en info-bulle. */
  label: string;
  icon: LucideIcon;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: keyof typeof iconButtonSizes;
  /** Info-bulle au survol (par defaut : oui). */
  tooltip?: boolean;
  loading?: boolean;
}

/** Bouton constitue d'une seule icone. Toujours nomme, toujours focusable. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, icon: Icon, variant = 'ghost', size = 'md', tooltip = true, loading = false, disabled, className, type = 'button', ...props }, ref) => {
    const button = (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(buttonVariants({ variant }), 'px-0', iconButtonSizes[size], className)}
        {...props}
      >
        {loading ? <Loader2 className="icon-sm animate-spin" aria-hidden /> : <Icon className={size === 'lg' ? 'icon-md' : 'icon-sm'} aria-hidden />}
      </button>
    );
    return tooltip ? <Tooltip content={label}>{button}</Tooltip> : button;
  }
);
IconButton.displayName = 'IconButton';
