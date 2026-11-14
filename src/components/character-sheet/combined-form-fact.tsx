'use client';
import { useId, type ReactNode } from 'react';
import { cn } from '~/lib/utils';
import { fieldLabel, isUnresolvedValue } from './sheet-parts';

/** One labelled value in a row of facts, with a line beneath when told. */
export function CombinedFormFact({
  label,
  value,
  valueClassName,
  className,
  children,
}: {
  label: string;
  value: string;
  /** Sizes a headline value; Unresolved stays small and muted. */
  valueClassName?: string;
  className?: string;
  children?: ReactNode;
}) {
  const labelId = useId();
  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      <dt id={labelId} className={fieldLabel}>
        {label}
      </dt>
      <dd
        aria-labelledby={labelId}
        className={cn(
          'font-mono text-base leading-tight tabular-nums',
          valueClassName,
          isUnresolvedValue(value) && 'text-muted-foreground text-sm',
        )}
      >
        {value}
      </dd>
      {children}
    </div>
  );
}
