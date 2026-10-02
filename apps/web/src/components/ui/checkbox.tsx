'use client';

import { useId, type ReactNode } from 'react';
import * as RadixCheckbox from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  label: ReactNode;
  description?: ReactNode;
  className?: string;
}

/** Case a cocher toujours accompagnee de son libelle cliquable. */
export function Checkbox({ label, description, className, onCheckedChange, ...props }: CheckboxProps) {
  const id = useId();
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <RadixCheckbox.Root
        id={id}
        {...props}
        onCheckedChange={(value) => onCheckedChange?.(value === true)}
        aria-describedby={description ? `${id}-d` : undefined}
        className={cn(
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-border-strong bg-surface',
          'transition-colors duration-fast data-[state=checked]:border-brand data-[state=checked]:bg-brand',
          'disabled:cursor-not-allowed disabled:border-border-subtle disabled:bg-background-subtle'
        )}
      >
        <RadixCheckbox.Indicator>
          <Check className="h-3 w-3 text-brand-foreground" strokeWidth={3} aria-hidden />
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="cursor-pointer text-body-sm text-foreground">{label}</label>
        {description && <p id={`${id}-d`} className="text-caption text-foreground-muted">{description}</p>}
      </div>
    </div>
  );
}
