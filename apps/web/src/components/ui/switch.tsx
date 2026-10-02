'use client';

import { useId, type ReactNode } from 'react';
import * as RadixSwitch from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  label: ReactNode;
  description?: ReactNode;
  className?: string;
}

/** Interrupteur on/off, effet immediat. Libelle a gauche, controle a droite. */
export function Switch({ label, description, className, ...props }: SwitchProps) {
  const id = useId();
  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="text-body-sm text-foreground">{label}</label>
        {description && <p id={`${id}-d`} className="text-caption text-foreground-muted">{description}</p>}
      </div>
      <RadixSwitch.Root
        id={id}
        {...props}
        aria-describedby={description ? `${id}-d` : undefined}
        className={cn(
          'relative h-5 w-9 shrink-0 cursor-pointer rounded-full bg-border-strong transition-colors duration-fast',
          'data-[state=checked]:bg-brand disabled:cursor-not-allowed disabled:bg-border-subtle'
        )}
      >
        <RadixSwitch.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-surface-raised shadow-subtle transition-transform duration-fast ease-standard data-[state=checked]:translate-x-4" />
      </RadixSwitch.Root>
    </div>
  );
}
