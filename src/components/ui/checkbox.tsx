'use client';
import type { ComponentProps } from 'react';

import { cn } from '~/lib/utils';

// A native checkbox in shadcn's Checkbox shape (checked, onCheckedChange), so
// the Radix version can replace this file without touching call sites.
function Checkbox({
  className,
  onChange,
  onCheckedChange,
  ...props
}: Omit<ComponentProps<'input'>, 'type'> & {
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn(
        'accent-primary border-input focus-visible:ring-ring/50 size-4 shrink-0 border outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      onChange={(event) => {
        onChange?.(event);
        onCheckedChange?.(event.target.checked);
      }}
      {...props}
    />
  );
}

export { Checkbox };
