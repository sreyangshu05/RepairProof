import * as React from 'react';
import { cn } from '../../lib/utils';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

function EmptyState({ title, description, icon, action, className, ...props }: EmptyStateProps) {
  return (
    <section
      className={cn(
        'flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed bg-card px-5 py-10 text-center',
        className,
      )}
      {...props}
    >
      {icon && (
        <div aria-hidden="true" className="mb-3 text-muted-foreground">
          {icon}
        </div>
      )}
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </section>
  );
}

export { EmptyState };
