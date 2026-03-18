import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border border-fd-border px-2 py-0.5 text-xs font-semibold transition',
  {
    variants: {
      variant: {
        default: 'bg-fd-muted text-fd-muted-foreground',
        secondary: 'bg-fd-card text-fd-foreground',
        success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
        destructive: 'border-red-200 bg-red-50 text-red-900',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant, className }))} {...props} />;
}

export { Badge, badgeVariants };

