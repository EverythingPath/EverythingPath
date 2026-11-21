'use client';
import type { ReactNode } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { cn } from '~/lib/utils';
import { missingChoice } from './sheet-parts';

// The empty choice has to be an item of its own: a Select item cannot carry
// the empty string that the forms use for "nothing chosen".
const noChoice = 'none';

export type ChoiceOption = { value: string; label: string };

/**
 * A compact chooser for one of a row's choices (approved prototype's pick
 * field): the empty choice is an option like any other so every choice can
 * be cleared, a missing choice wears the sheet's blue outline, and a choice
 * the rules do not expect here is dimmed until it is made.
 */
export function ChoiceSelect({
  label,
  value,
  options,
  emptyLabel,
  isMissing = false,
  isDim = false,
  disabled = false,
  describedBy,
  className,
  onValueChange,
  renderTrigger = (trigger) => trigger,
}: {
  label: string;
  value: string;
  options: readonly ChoiceOption[];
  emptyLabel: string;
  isMissing?: boolean;
  isDim?: boolean;
  disabled?: boolean;
  /** Ids of the text that describes the choice: its help, its missing prompt. */
  describedBy?: string;
  className?: string;
  onValueChange: (value: string) => void;
  /** Wraps the trigger, for a form's control slot. */
  renderTrigger?: (trigger: ReactNode) => ReactNode;
}) {
  return (
    <Select
      value={value === '' ? noChoice : value}
      disabled={disabled}
      onValueChange={(next) => onValueChange(next === noChoice ? '' : next)}
    >
      {renderTrigger(
        <SelectTrigger
          aria-label={label}
          aria-describedby={describedBy}
          className={cn(
            'h-10 w-full rounded-none font-mono text-sm md:h-8 md:py-1',
            isMissing && missingChoice,
            isDim && value === '' && 'text-muted-foreground',
            className,
          )}
        >
          <SelectValue />
        </SelectTrigger>,
      )}
      <SelectContent>
        <SelectItem value={noChoice}>{emptyLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
