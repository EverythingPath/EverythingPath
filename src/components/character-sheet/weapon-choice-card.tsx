'use client';
import { useId } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { chip } from './sheet-parts';

// A playing card (the product's card choices): lifts on hover unless motion
// is reduced, named by the weapon, described by its facts.
const card =
  'bg-card border-foreground/25 hover:border-primary/60 h-auto min-h-16 w-full min-w-0 touch-manipulation flex-col items-start justify-start gap-0.5 rounded-none border-2 px-2.5 py-1.5 text-left font-normal whitespace-normal shadow-xs transition-transform motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5';

/** One weapon to pick: its label, facts, and an optional note such as "Switched off". */
export function WeaponChoiceCard({
  label,
  facts,
  note,
  isDisabled,
  describedBy,
  onPick,
}: {
  label: string;
  facts: string;
  note?: string;
  isDisabled: boolean;
  /** The maintenance reason while writes are paused. */
  describedBy?: string;
  onPick: () => void;
}) {
  const id = useId();
  return (
    <Button
      type="button"
      variant="outline"
      aria-labelledby={`${id}-name`}
      aria-describedby={cn(note && `${id}-note`, `${id}-facts`, describedBy)}
      disabled={isDisabled}
      onClick={onPick}
      className={card}
    >
      <span className="flex w-full flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span
          id={`${id}-name`}
          className="min-w-0 font-sans text-base leading-tight [overflow-wrap:anywhere]"
        >
          {label}
        </span>
        {note ? (
          <span id={`${id}-note`} className={cn(chip, 'text-muted-foreground')}>
            {note}
          </span>
        ) : null}
      </span>
      <span
        id={`${id}-facts`}
        className="text-muted-foreground font-mono text-xs [overflow-wrap:anywhere]"
      >
        {facts}
      </span>
    </Button>
  );
}
