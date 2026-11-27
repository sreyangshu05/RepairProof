import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const alertVariants = cva(
  'relative w-full rounded-md border p-4 text-sm [&>svg+div]:translate-y-[-2px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg~*]:pl-7',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground',
        info: 'border-info/40 bg-info/10 text-foreground',
        success: 'border-success/40 bg-success/10 text-foreground',
        warning: 'border-warning/40 bg-warning/10 text-foreground',
        destructive: 'border-destructive/40 bg-destructive/10 text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

type AlertProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof alertVariants> & { live?: 'polite' | 'assertive' | 'off' };

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, live, role, ...props }, ref) => (
    <div
      ref={ref}
      role={role ?? (variant === 'destructive' ? 'alert' : 'status')}
      aria-live={live ?? (variant === 'destructive' ? 'assertive' : 'polite')}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  ),
);
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5
      ref={ref}
      className={cn('mb-1 font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  ),
);
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-sm leading-relaxed [&_p]:leading-relaxed', className)}
    {...props}
  />
));
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
