'use client';

import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { controlClasses, useField } from './field';

/** Zone de texte. Dans un <Field>, recoit automatiquement id et aria-*. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    const field = useField();
    return (
      <textarea
        ref={ref}
        id={field?.id}
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid || undefined}
        required={field?.required}
        className={cn(controlClasses, 'min-h-20 resize-none px-3 py-2', className)}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';
