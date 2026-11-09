'use client';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { cn } from '~/lib/utils';
import { missingChoice } from './sheet-parts';
import {
  decodeTargetChoice,
  encodeTargetChoice,
  noTarget,
  type TargetChoice,
  type TargetOption,
} from './spell-effect-target-choice';

/**
 * The Target select from 768px (#416): "No target", the parts the rules
 * expect, the rest under "Other items", and a recorded target that left the
 * sheet as a disabled "No longer on the sheet".
 */
export function SpellEffectTargetSelect({
  value,
  isMissing,
  isPlaceholder,
  isDisabled,
  describedBy,
  suitable,
  unsuitable,
  unavailableText,
  onChoose,
}: {
  value: TargetChoice;
  /** The field waits for a choice: the blue missing-choice outline. */
  isMissing: boolean;
  /** No target is recorded: the trigger reads muted. */
  isPlaceholder: boolean;
  isDisabled: boolean;
  describedBy?: string;
  suitable: readonly TargetOption[];
  unsuitable: readonly TargetOption[];
  /** Set while the recorded target is no longer on the sheet. */
  unavailableText: string | null;
  onChoose: (choice: TargetChoice) => void;
}) {
  const selected = encodeTargetChoice(value);
  const item = (option: TargetOption) => {
    const optionValue = encodeTargetChoice({ kind: 'part', ...option });
    return (
      <SelectItem key={optionValue} value={optionValue}>
        {option.name}
        {option.active ? null : (
          <span className="text-muted-foreground"> · not equipped</span>
        )}
      </SelectItem>
    );
  };
  return (
    <Select
      value={selected}
      disabled={isDisabled}
      onValueChange={(next) => {
        const choice = decodeTargetChoice(next);
        if (choice) onChoose(choice);
      }}
    >
      <SelectTrigger
        aria-label="Target"
        aria-describedby={describedBy}
        className={cn(
          'h-11 w-full rounded-none font-mono text-sm md:h-8 md:py-1',
          isMissing && missingChoice,
          isPlaceholder && 'text-muted-foreground',
        )}
      >
        <SelectValue placeholder="No target" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={encodeTargetChoice(noTarget)}>No target</SelectItem>
        {suitable.map(item)}
        {unsuitable.length > 0 ? (
          <SelectGroup>
            <SelectLabel>Other items</SelectLabel>
            {unsuitable.map(item)}
          </SelectGroup>
        ) : null}
        {unavailableText !== null && value.kind === 'part' ? (
          <SelectItem value={selected} disabled>
            {unavailableText}
          </SelectItem>
        ) : null}
      </SelectContent>
    </Select>
  );
}
