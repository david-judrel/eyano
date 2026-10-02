'use client';

import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import * as RadixPopover from '@radix-ui/react-popover';
import * as RadixMenu from '@radix-ui/react-dropdown-menu';
import * as RadixDialog from '@radix-ui/react-dialog';
import { X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton } from './button';

/*
 * Systeme d'overlays EYANO (Radix) : meme surface (surface-overlay, bordure,
 * rounded-lg/xl, shadow-overlay), memes couches (z-dropdown, z-overlay,
 * z-modal), memes animations. Focus piege, Echap, clic exterieur et retour
 * du focus sont geres par Radix.
 */

const floatingSurface = 'rounded-lg border border-border bg-surface-overlay shadow-overlay';

/* --------------------------------------------------------------- Popover */

export const Popover = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;
export const PopoverClose = RadixPopover.Close;

export const PopoverContent = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof RadixPopover.Content>>(
  ({ className, sideOffset = 8, ...props }, ref) => (
    <RadixPopover.Portal>
      <RadixPopover.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn('z-dropdown w-72 p-4 animate-scale-in', floatingSurface, className)}
        {...props}
      />
    </RadixPopover.Portal>
  )
);
PopoverContent.displayName = 'PopoverContent';

/* ---------------------------------------------------------- DropdownMenu */

export const DropdownMenu = RadixMenu.Root;
export const DropdownMenuTrigger = RadixMenu.Trigger;

export const DropdownMenuContent = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof RadixMenu.Content>>(
  ({ className, sideOffset = 6, ...props }, ref) => (
    <RadixMenu.Portal>
      <RadixMenu.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn('z-dropdown min-w-48 p-1 animate-scale-in', floatingSurface, className)}
        {...props}
      />
    </RadixMenu.Portal>
  )
);
DropdownMenuContent.displayName = 'DropdownMenuContent';

interface MenuItemProps extends ComponentPropsWithoutRef<typeof RadixMenu.Item> {
  icon?: LucideIcon;
  /** Texte secondaire aligne a droite (raccourci, precision). */
  hint?: ReactNode;
  destructive?: boolean;
}

export const DropdownMenuItem = forwardRef<HTMLDivElement, MenuItemProps>(
  ({ className, icon: Icon, hint, destructive = false, children, ...props }, ref) => (
    <RadixMenu.Item
      ref={ref}
      className={cn(
        'flex h-9 cursor-pointer select-none items-center gap-2 rounded-md px-2 text-body-sm outline-none',
        'data-[highlighted]:bg-hover data-[disabled]:cursor-not-allowed data-[disabled]:text-foreground-disabled',
        destructive ? 'text-error' : 'text-foreground',
        className
      )}
      {...props}
    >
      {Icon && <Icon className={cn('icon-sm', destructive ? 'text-error' : 'text-foreground-muted')} aria-hidden />}
      <span className="flex-1 truncate">{children}</span>
      {hint && <span className="text-caption text-foreground-muted">{hint}</span>}
    </RadixMenu.Item>
  )
);
DropdownMenuItem.displayName = 'DropdownMenuItem';

export function DropdownMenuSeparator() {
  return <RadixMenu.Separator className="my-1 h-px bg-border-subtle" />;
}

export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  return <RadixMenu.Label className="px-2 pb-1 pt-2 text-caption text-foreground-muted">{children}</RadixMenu.Label>;
}

/* ---------------------------------------------------------------- Dialog */

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

interface DialogContentProps extends Omit<ComponentPropsWithoutRef<typeof RadixDialog.Content>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  /** Pied : actions alignees a droite. */
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const dialogSizes = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-xl' } as const;

/** Fenetre : feuille basse sur mobile, centree des `sm`. Titre obligatoire. */
export function DialogContent({ title, description, footer, size = 'md', className, children, ...props }: DialogContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-modal bg-scrim animate-fade-in" />
      <RadixDialog.Content
        className={cn(
          'fixed z-modal flex max-h-[85dvh] w-full flex-col border border-border bg-surface-overlay shadow-overlay outline-none',
          'inset-x-0 bottom-0 rounded-t-xl animate-slide-up',
          'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:animate-scale-in',
          dialogSizes[size],
          className
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
          <div className="flex flex-col gap-1">
            <RadixDialog.Title className="text-heading-md text-foreground">{title}</RadixDialog.Title>
            {description ? (
              <RadixDialog.Description className="text-body-sm text-foreground-muted">{description}</RadixDialog.Description>
            ) : (
              <RadixDialog.Description className="sr-only">{typeof title === 'string' ? title : 'Fenêtre'}</RadixDialog.Description>
            )}
          </div>
          <RadixDialog.Close asChild>
            <IconButton label="Fermer" icon={X} size="sm" tooltip={false} />
          </RadixDialog.Close>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-2">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-6 pb-6 pt-4">{footer}</div>}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

/* ----------------------------------------------------------------- Sheet */

export const Sheet = RadixDialog.Root;
export const SheetTrigger = RadixDialog.Trigger;
export const SheetClose = RadixDialog.Close;

interface SheetContentProps extends Omit<ComponentPropsWithoutRef<typeof RadixDialog.Content>, 'title'> {
  /** Nom accessible du tiroir (lu, non affiche). */
  title: string;
  side?: 'left' | 'right';
}

/** Tiroir lateral (navigation mobile). Le contenu fournit sa propre structure. */
export function SheetContent({ title, side = 'left', className, children, ...props }: SheetContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-overlay bg-scrim animate-fade-in" />
      <RadixDialog.Content
        className={cn(
          'fixed inset-y-0 z-overlay flex w-sidebar max-w-[85vw] flex-col border-border bg-background-subtle shadow-overlay outline-none',
          side === 'left' ? 'left-0 border-r animate-slide-in-left' : 'right-0 border-l animate-slide-in-right',
          className
        )}
        {...props}
      >
        <RadixDialog.Title className="sr-only">{title}</RadixDialog.Title>
        <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
