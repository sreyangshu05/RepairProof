import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

const NotificationProvider = ToastPrimitive.Provider;
const NotificationViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      'fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col gap-2 p-4 sm:bottom-4 sm:right-4 sm:top-auto sm:max-w-sm',
      className,
    )}
    {...props}
  />
));
NotificationViewport.displayName = ToastPrimitive.Viewport.displayName;

const Notification = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root> & {
    variant?: 'default' | 'success' | 'warning' | 'destructive';
  }
>(({ className, variant = 'default', ...props }, ref) => (
  <ToastPrimitive.Root
    ref={ref}
    className={cn(
      'relative grid w-full grid-cols-[1fr_auto] gap-x-3 gap-y-1 rounded-lg border bg-card p-4 text-card-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-bottom-4 sm:data-[state=open]:slide-in-from-right-4',
      variant === 'success' && 'border-success/50',
      variant === 'warning' && 'border-warning/50',
      variant === 'destructive' && 'border-destructive/50',
      className,
    )}
    {...props}
  />
));
Notification.displayName = ToastPrimitive.Root.displayName;
const NotificationTitle = ToastPrimitive.Title;
const NotificationDescription = ToastPrimitive.Description;
const NotificationAction = ToastPrimitive.Action;
const NotificationClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Close
    ref={ref}
    aria-label="Dismiss notification"
    className={cn(
      'inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      className,
    )}
    {...props}
  >
    <X aria-hidden="true" className="h-4 w-4" />
  </ToastPrimitive.Close>
));
NotificationClose.displayName = ToastPrimitive.Close.displayName;

export {
  NotificationProvider,
  NotificationViewport,
  Notification,
  NotificationTitle,
  NotificationDescription,
  NotificationAction,
  NotificationClose,
};
