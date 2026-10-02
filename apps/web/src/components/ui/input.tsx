'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { controlClasses, useField } from './field';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'md' | 'lg';
}

/** Champ texte. Dans un <Field>, recoit automatiquement id et aria-*. */
export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, type = 'text', size = 'md', ...props }, ref) => {
  const field = useField();
  return (
    <input
      ref={ref}
      type={type}
      id={field?.id}
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      required={field?.required}
      className={cn(controlClasses, size === 'lg' ? 'h-12 px-4' : 'h-10 px-3', className)}
      {...props}
    />
  );
});
Input.displayName = 'Input';
