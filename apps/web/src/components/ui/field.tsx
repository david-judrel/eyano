'use client';

import { createContext, useContext, useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FieldState {
  id: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldState | null>(null);

/** Relie un controle (Input, Textarea, Select...) a son libelle et ses messages. */
export function useField(): FieldState | null {
  return useContext(FieldContext);
}

interface FieldProps {
  label: ReactNode;
  description?: ReactNode;
  /** Message d'erreur : rend le controle invalide (aria-invalid). */
  error?: ReactNode;
  required?: boolean;
  /** Masque visuellement le libelle (il reste lu par les lecteurs d'ecran). */
  hideLabel?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({ label, description, error, required = false, hideLabel = false, className, children }: FieldProps) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error), required }}>
      <div className={cn('flex flex-col gap-1.5', className)}>
        <label htmlFor={id} className={cn('text-label text-foreground-secondary', hideLabel && 'sr-only')}>
          {label}
          {required && <span className="ml-0.5 text-error" aria-hidden>*</span>}
        </label>
        {children}
        {description && !error && (
          <p id={descriptionId} className="text-caption text-foreground-muted">{description}</p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-caption text-error">{error}</p>
        )}
      </div>
    </FieldContext.Provider>
  );
}

/** Classes communes des champs de saisie (Input, Textarea, declencheur de Select). */
export const controlClasses = cn(
  'w-full rounded-md border border-border bg-surface text-body-md text-foreground placeholder:text-foreground-muted touch:text-body-lg',
  'transition-colors duration-fast ease-standard hover:border-border-strong',
  'focus-visible:border-focus',
  'aria-[invalid=true]:border-error',
  'disabled:cursor-not-allowed disabled:border-border-subtle disabled:bg-background-subtle disabled:text-foreground-disabled'
);
