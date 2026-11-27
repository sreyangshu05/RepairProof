import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

const Drawer = DialogPrimitive.Root;
const DrawerTrigger = DialogPrimitive.Trigger;
const DrawerClose = DialogPrimitive.Close;

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    side?: 'left' | 'right' | 'bottom';
  }
>(({ className, children, side = 'right', onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => {
  const previouslyFocused = React.useRef<HTMLElement | null>(null);
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/55" />
      <DialogPrimitive.Content
        ref={ref}
        aria-modal="true"
        onOpenAutoFocus={(event) => {
          previouslyFocused.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
          onOpenAutoFocus?.(event);
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          if (!event.defaultPrevented && previouslyFocused.current?.isConnected) {
            event.preventDefault();
            previouslyFocused.current.focus({ preventScroll: true });
          }
        }}
        className={cn(
          'fixed z-50 flex flex-col gap-4 border bg-card p-5 shadow-lg outline-none',
          side === 'right' && 'inset-y-0 right-0 h-dvh w-[min(88vw,28rem)] border-l',
          side === 'left' && 'inset-y-0 left-0 h-dvh w-[min(88vw,28rem)] border-r',
          side === 'bottom' &&
            'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-xl border-t pb-[max(1.25rem,env(safe-area-inset-bottom))]',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <X aria-hidden="true" className="h-4 w-4" />
          <span className="sr-only">Close panel</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});
DrawerContent.displayName = DialogPrimitive.Content.displayName;

function DrawerHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('pr-10 text-left', className)} {...props} />;
}
function DrawerFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-auto flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}
const DrawerTitle = DialogPrimitive.Title;
const DrawerDescription = DialogPrimitive.Description;

export {
  Drawer,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
