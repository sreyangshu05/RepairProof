import * as React from 'react';
import { Label } from './label';
import { cn } from '../../lib/utils';

export interface FormFieldProps {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

function FormField({ id, label, hint, error, required, children, className }: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span aria-hidden="true" className="ml-1 text-destructive">
            *
          </span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </Label>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
            id,
            'aria-describedby': [hintId, errorId].filter(Boolean).join(' ') || undefined,
            'aria-invalid': error ? true : undefined,
          })
        : children}
      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export { FormField };
