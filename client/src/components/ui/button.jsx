import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground rounded-md hover:bg-primary-600',
        destructive: 'bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90',
        outline: 'border border-input bg-background rounded-md hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground rounded-md',
        link: 'text-primary underline-offset-4 hover:underline',
        disable: 'bg-ust-gray-400 text-ust-gray-600 rounded-md cursor-not-allowed',
        no_style: 'bg-transparent text-foreground',
      },
      size: {
        default: 'px-4 py-1 h-10',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = 'Button';

export { Button, buttonVariants };
