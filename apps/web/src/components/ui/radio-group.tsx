import * as React from 'react';
import { cn } from '../../lib/utils';

const RadioGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    name: string;
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
  }
>(({ className, name, value, defaultValue, onValueChange, onChange, ...props }, ref) => (
  <div
    ref={ref}
    role="radiogroup"
    className={cn('grid gap-2', className)}
    onChange={(event) => {
      onChange?.(event);
      const target = event.target;
      if (target instanceof HTMLInputElement && target.name === name && target.checked)
        onValueChange?.(target.value);
    }}
    {...props}
  >
    {React.Children.map(props.children, (child) => {
      if (!React.isValidElement<RadioGroupItemProps>(child) || child.type !== RadioGroupItem)
        return child;
      return React.cloneElement(child, {
        name,
        checked: value !== undefined ? child.props.value === value : undefined,
        defaultChecked: value === undefined ? child.props.value === defaultValue : undefined,
      });
    })}
  </div>
));
RadioGroup.displayName = 'RadioGroup';

export type RadioGroupItemProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;
const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="radio"
      className={cn(
        'h-5 w-5 cursor-pointer accent-[hsl(var(--primary))] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
RadioGroupItem.displayName = 'RadioGroupItem';

export { RadioGroup, RadioGroupItem };
