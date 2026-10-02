'use client';

import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import * as RadixTabs from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

/** Onglets : navigation au clavier (fleches) geree par Radix. */
export const Tabs = RadixTabs.Root;

export const TabsList = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof RadixTabs.List>>(
  ({ className, ...props }, ref) => (
    <RadixTabs.List ref={ref} className={cn('flex gap-1 border-b border-border-subtle', className)} {...props} />
  )
);
TabsList.displayName = 'TabsList';

export const TabsTrigger = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof RadixTabs.Trigger>>(
  ({ className, ...props }, ref) => (
    <RadixTabs.Trigger
      ref={ref}
      className={cn(
        '-mb-px h-10 border-b-2 border-transparent px-3 text-label text-foreground-muted transition-colors duration-fast',
        'hover:text-foreground data-[state=active]:border-foreground data-[state=active]:text-foreground',
        className
      )}
      {...props}
    />
  )
);
TabsTrigger.displayName = 'TabsTrigger';

export const TabsContent = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof RadixTabs.Content>>(
  ({ className, ...props }, ref) => <RadixTabs.Content ref={ref} className={cn('pt-4', className)} {...props} />
);
TabsContent.displayName = 'TabsContent';
