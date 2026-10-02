'use client';

import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { controlClasses, useField } from './field';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  /** Nom accessible quand le Select n'est pas dans un <Field>. */
  'aria-label'?: string;
  className?: string;
}

/** Liste de choix (Radix) : clavier, saisie rapide, focus et Echap geres. */
export function Select({ options, placeholder, size = 'md', className, ...props }: SelectProps) {
  const field = useField();
  return (
    <RadixSelect.Root value={props.value} defaultValue={props.defaultValue} onValueChange={props.onValueChange} disabled={props.disabled}>
      <RadixSelect.Trigger
        id={field?.id}
        aria-label={props['aria-label']}
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid || undefined}
        className={cn(controlClasses, 'flex items-center justify-between gap-2 text-left', size === 'sm' ? 'h-8 px-2 text-body-sm' : 'h-10 px-3', className)}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown className="icon-sm text-foreground-muted" aria-hidden />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className="z-dropdown min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-border bg-surface-overlay p-1 shadow-overlay animate-scale-in"
        >
          <RadixSelect.Viewport>
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="relative flex h-8 cursor-pointer select-none items-center rounded-sm pl-8 pr-3 text-body-sm text-foreground outline-none data-[disabled]:cursor-not-allowed data-[highlighted]:bg-hover data-[disabled]:text-foreground-disabled"
              >
                <RadixSelect.ItemIndicator className="absolute left-2">
                  <Check className="icon-sm text-brand-text" aria-hidden />
                </RadixSelect.ItemIndicator>
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
