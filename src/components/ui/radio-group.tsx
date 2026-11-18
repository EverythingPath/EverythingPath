'use client';
import { createContext, useContext, type ComponentProps } from 'react';

import { cn } from '~/lib/utils';

// Native radios in shadcn's RadioGroup shape (value, onValueChange), so the
// Radix version can replace this file without touching call sites. Each item
// is a card: the native radio stays for the keyboard and the screen reader;
// the card around it shows the selection.

type RadioGroupState = {
  name?: string;
  value?: string;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
  onBlur?: () => void;
};

const RadioGroupContext = createContext<RadioGroupState>({});

function RadioGroup({
  name,
  value,
  disabled,
  onValueChange,
  onBlur,
  className,
  ...props
}: Omit<ComponentProps<'div'>, 'onBlur'> & RadioGroupState) {
  return (
    <RadioGroupContext.Provider
      value={{ name, value, disabled, onValueChange, onBlur }}
    >
      <div
        role="radiogroup"
        data-slot="radio-group"
        className={cn('grid gap-2', className)}
        {...props}
      />
    </RadioGroupContext.Provider>
  );
}

function RadioGroupItem({
  value,
  className,
  children,
  ...props
}: Omit<ComponentProps<'input'>, 'type' | 'value'> & { value: string }) {
  const group = useContext(RadioGroupContext);
  return (
    <label
      data-slot="radio-group-item"
      className={cn(
        'border-foreground/40 bg-card has-checked:border-primary has-checked:text-primary has-focus-visible:ring-ring/50 flex min-h-11 cursor-pointer items-center justify-center border px-3 py-1.5 font-mono text-sm transition-colors has-checked:shadow-xs has-focus-visible:ring-[3px] has-disabled:cursor-not-allowed has-disabled:opacity-50 md:min-h-9',
        className,
      )}
    >
      <input
        type="radio"
        className="sr-only"
        name={group.name}
        value={value}
        checked={group.value === undefined ? undefined : group.value === value}
        disabled={group.disabled}
        onBlur={group.onBlur}
        onChange={() => group.onValueChange?.(value)}
        {...props}
      />
      {children}
    </label>
  );
}

export { RadioGroup, RadioGroupItem };
