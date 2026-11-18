'use client';
import { useId } from 'react';
import { Checkbox } from '~/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { cn } from '~/lib/utils';
import type { ReplacementScope } from './character-sheet-archetypes-view-model';
import { chip } from './sheet-parts';

function isReplacementScope(value: string): value is ReplacementScope {
  return value === 'whole' || value === 'part';
}

const rowCard =
  'border-foreground/20 has-checked:border-primary has-focus-visible:ring-ring/50 flex min-h-11 min-w-0 cursor-pointer items-center gap-2 border px-2.5 py-1 text-sm has-focus-visible:ring-[3px] has-disabled:cursor-not-allowed has-disabled:opacity-50 md:min-h-8';
const scopeCard = 'min-h-11 px-2 py-0.5 text-xs md:min-h-7';

export type PartChoiceRow = {
  key: string;
  classLevel: number;
  name: string;
  /** Not yet reached by this class's levels. */
  isLater: boolean;
  /** One independently replaceable part of a larger feature. */
  isPart: boolean;
  /** A chosen row the class's schedule does not have. */
  isUnmatched: boolean;
};

/**
 * One class feature row in the replacement editor: checked when the
 * Archetype replaces it, and for a part of a larger feature, whether the
 * replacement takes the whole feature or only this part.
 */
export function ArchetypePartChoice({
  row,
  archetypeName,
  baseClassName,
  isChecked,
  scope,
  isDisabled,
  onToggle,
  onScopeChange,
}: {
  row: PartChoiceRow;
  archetypeName: string;
  baseClassName: string;
  isChecked: boolean;
  /** The chosen extent; an unstated one replaces only this part. */
  scope: ReplacementScope | undefined;
  isDisabled: boolean;
  onToggle: (isChecked: boolean) => void;
  onScopeChange: (scope: ReplacementScope) => void;
}) {
  const scopeName = useId();
  const place = `${baseClassName} level ${row.classLevel}`;
  return (
    <li className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
      <label className={cn(rowCard, row.isLater && 'text-muted-foreground')}>
        <Checkbox
          checked={isChecked}
          disabled={isDisabled}
          aria-label={`${archetypeName} replaces ${row.name}, ${place}`}
          onCheckedChange={onToggle}
        />
        <span className="text-muted-foreground font-mono text-xs">
          Level {row.classLevel}
        </span>
        <span className="min-w-0 [overflow-wrap:anywhere]">{row.name}</span>
        {row.isLater ? (
          <span className={cn(chip, 'text-muted-foreground')}>Later level</span>
        ) : null}
        {row.isUnmatched ? (
          <span className={cn(chip, 'text-amber-300')}>Not in this class</span>
        ) : null}
      </label>
      {row.isPart && isChecked ? (
        <RadioGroup
          aria-label={`Extent of the ${row.name} replacement, ${place}`}
          name={scopeName}
          value={scope ?? 'part'}
          disabled={isDisabled}
          className="flex flex-wrap gap-1"
          onValueChange={(value) => {
            if (isReplacementScope(value)) onScopeChange(value);
          }}
        >
          <RadioGroupItem value="whole" className={scopeCard}>
            Whole feature
          </RadioGroupItem>
          <RadioGroupItem value="part" className={scopeCard}>
            Independent part
          </RadioGroupItem>
        </RadioGroup>
      ) : null}
    </li>
  );
}
